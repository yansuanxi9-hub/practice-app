import Foundation
import CoreFoundation
import UniformTypeIdentifiers

enum QuestionImportError: LocalizedError {
    case unsupportedFileType(String)
    case emptyFile
    case invalidJSON(String)
    case invalidCSV(String)
    case invalidTXT(String)
    case invalidDOCX(String)

    var errorDescription: String? {
        switch self {
        case .unsupportedFileType(let ext):
            return "暂不支持 .\(ext) 文件。请导入 json、csv、txt 或 docx。"
        case .emptyFile:
            return "文件内容为空，请检查题库文件。"
        case .invalidJSON(let message):
            return "JSON 解析失败：\(message)"
        case .invalidCSV(let message):
            return "CSV 解析失败：\(message)"
        case .invalidTXT(let message):
            return "TXT 解析失败：\(message)"
        case .invalidDOCX(let message):
            return "DOCX 解析失败：\(message)"
        }
    }
}

struct ImportedQuestionDraft {
    var stem: String
    var options: [String]
    var correctAnswer: String
    var explanation: String
    var type: QuestionType
    var source: String
}

enum QuestionImporter {
    static let allowedContentTypes: [UTType] = [
        .json,
        .commaSeparatedText,
        .plainText,
        UTType(filenameExtension: "docx") ?? .data
    ]

    static func importDrafts(from url: URL) throws -> [ImportedQuestionDraft] {
        let didStartAccessing = url.startAccessingSecurityScopedResource()
        defer {
            if didStartAccessing {
                url.stopAccessingSecurityScopedResource()
            }
        }

        let ext = url.pathExtension.lowercased()

        switch ext {
        case "json":
            return try parseJSON(data: Data(contentsOf: url))
        case "csv":
            return try parseCSV(text: readTextFile(url))
        case "txt":
            return try parseTXT(text: readTextFile(url))
        case "docx":
            let text = try DOCXTextExtractor.extractText(from: url)
            return try parseTXT(text: text)
        default:
            throw QuestionImportError.unsupportedFileType(ext.isEmpty ? "未知类型" : ext)
        }
    }

    private static func readTextFile(_ url: URL) throws -> String {
        let data = try Data(contentsOf: url)
        guard !data.isEmpty else {
            throw QuestionImportError.emptyFile
        }

        if let text = String(data: data, encoding: .utf8) {
            return text
        }

        if let text = String(data: data, encoding: .unicode) {
            return text
        }

        if let text = String(data: data, encoding: .gb18030) {
            return text
        }

        throw QuestionImportError.invalidTXT("无法识别文本编码，请另存为 UTF-8 后再导入。")
    }

    private static func parseJSON(data: Data) throws -> [ImportedQuestionDraft] {
        guard !data.isEmpty else {
            throw QuestionImportError.emptyFile
        }

        do {
            let rows = try JSONDecoder().decode([JSONQuestionRow].self, from: data)
            return try rows.enumerated().map { index, row in
                try row.toDraft(rowNumber: index + 1)
            }
        } catch let error as QuestionImportError {
            throw error
        } catch {
            throw QuestionImportError.invalidJSON(error.localizedDescription)
        }
    }

    private static func parseCSV(text: String) throws -> [ImportedQuestionDraft] {
        let rows = parseCSVRows(text)
            .filter { row in row.contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty } }

        guard let header = rows.first else {
            throw QuestionImportError.emptyFile
        }

        let normalizedHeader = header.map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
        let requiredColumns = ["question", "a", "b", "c", "d", "answer", "explanation", "type", "source"]

        for column in requiredColumns where !normalizedHeader.contains(column) {
            throw QuestionImportError.invalidCSV("缺少表头列：\(column)。")
        }

        let columnIndex = Dictionary(uniqueKeysWithValues: normalizedHeader.enumerated().map { ($0.element, $0.offset) })
        let dataRows = rows.dropFirst()

        guard !dataRows.isEmpty else {
            throw QuestionImportError.invalidCSV("没有找到题目数据。")
        }

        return try dataRows.enumerated().map { offset, row in
            let rowNumber = offset + 2

            func value(_ key: String) -> String {
                guard let index = columnIndex[key], row.indices.contains(index) else {
                    return ""
                }
                return row[index].trimmingCharacters(in: .whitespacesAndNewlines)
            }

            return try makeDraft(
                rowNumber: rowNumber,
                stem: value("question"),
                options: [value("a"), value("b"), value("c"), value("d")],
                answer: value("answer"),
                explanation: value("explanation"),
                type: value("type"),
                source: value("source"),
                errorFactory: QuestionImportError.invalidCSV
            )
        }
    }

    static func parseTXT(text: String) throws -> [ImportedQuestionDraft] {
        let normalizedText = text
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        let blocks = normalizedText
            .components(separatedBy: "\n题目：")
            .map { block -> String in
                block.hasPrefix("题目：") ? block : "题目：\(block)"
            }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { $0 != "题目：" && !$0.isEmpty }

        guard !blocks.isEmpty else {
            throw QuestionImportError.invalidTXT("没有找到“题目：”开头的题目块。")
        }

        return try blocks.enumerated().map { index, block in
            try parseTXTBlock(block, rowNumber: index + 1)
        }
    }

    private static func parseTXTBlock(_ block: String, rowNumber: Int) throws -> ImportedQuestionDraft {
        let lines = block
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        func lineValue(prefixes: [String]) -> String {
            for line in lines {
                for prefix in prefixes where line.hasPrefix(prefix) {
                    return String(line.dropFirst(prefix.count)).trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
            return ""
        }

        let source = lineValue(prefixes: ["来源：", "题库："])

        return try makeDraft(
            rowNumber: rowNumber,
            stem: lineValue(prefixes: ["题目："]),
            options: [
                lineValue(prefixes: ["A.", "A．", "A：", "A:"]),
                lineValue(prefixes: ["B.", "B．", "B：", "B:"]),
                lineValue(prefixes: ["C.", "C．", "C：", "C:"]),
                lineValue(prefixes: ["D.", "D．", "D：", "D:"])
            ],
            answer: lineValue(prefixes: ["答案：", "答案:"]),
            explanation: lineValue(prefixes: ["解析：", "解析:"]),
            type: lineValue(prefixes: ["类型：", "题型：", "type：", "type:"]),
            source: source.isEmpty ? "TXT 导入题库" : source,
            errorFactory: QuestionImportError.invalidTXT
        )
    }

    private static func makeDraft(
        rowNumber: Int,
        stem: String,
        options: [String],
        answer: String,
        explanation: String,
        type: String,
        source: String,
        errorFactory: (String) -> QuestionImportError
    ) throws -> ImportedQuestionDraft {
        let trimmedStem = stem.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedOptions = options.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        let normalizedAnswer = answer.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()

        guard !trimmedStem.isEmpty else {
            throw errorFactory("第 \(rowNumber) 题缺少题干。")
        }

        if let missingIndex = trimmedOptions.firstIndex(where: { $0.isEmpty }) {
            throw errorFactory("第 \(rowNumber) 题缺少选项 \(answerLetter(at: missingIndex))。")
        }

        guard ["A", "B", "C", "D"].contains(normalizedAnswer) else {
            throw errorFactory("第 \(rowNumber) 题答案必须是 A、B、C、D 之一。")
        }

        let normalizedType = type.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard normalizedType.isEmpty || ["single", "singlechoice", "单选", "单选题"].contains(normalizedType) else {
            throw errorFactory("第 \(rowNumber) 题暂只支持单选题。")
        }

        return ImportedQuestionDraft(
            stem: trimmedStem,
            options: trimmedOptions,
            correctAnswer: normalizedAnswer,
            explanation: explanation.trimmingCharacters(in: .whitespacesAndNewlines),
            type: .singleChoice,
            source: source.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "导入题库" : source
        )
    }

    private static func answerLetter(at index: Int) -> String {
        ["A", "B", "C", "D"][index]
    }

    private static func parseCSVRows(_ text: String) -> [[String]] {
        var rows: [[String]] = []
        var row: [String] = []
        var field = ""
        var isInsideQuotes = false
        var iterator = text.makeIterator()

        while let character = iterator.next() {
            if character == "\"" {
                if isInsideQuotes, let next = iterator.next() {
                    if next == "\"" {
                        field.append("\"")
                    } else {
                        isInsideQuotes = false
                        if next == "," {
                            row.append(field)
                            field = ""
                        } else if next == "\n" {
                            row.append(field)
                            rows.append(row)
                            row = []
                            field = ""
                        } else if next != "\r" {
                            field.append(next)
                        }
                    }
                } else {
                    isInsideQuotes.toggle()
                }
            } else if character == "," && !isInsideQuotes {
                row.append(field)
                field = ""
            } else if character == "\n" && !isInsideQuotes {
                row.append(field)
                rows.append(row)
                row = []
                field = ""
            } else if character != "\r" {
                field.append(character)
            }
        }

        row.append(field)
        rows.append(row)
        return rows
    }
}

private struct JSONQuestionRow: Decodable {
    var question: String
    var options: [String: String]
    var answer: String
    var explanation: String
    var type: String?
    var source: String?

    func toDraft(rowNumber: Int) throws -> ImportedQuestionDraft {
        try QuestionImporter.makeJSONDraft(
            rowNumber: rowNumber,
            stem: question,
            options: ["A", "B", "C", "D"].map { options[$0] ?? "" },
            answer: answer,
            explanation: explanation,
            type: type ?? "single",
            source: source ?? "JSON 导入题库"
        )
    }
}

private extension QuestionImporter {
    static func makeJSONDraft(
        rowNumber: Int,
        stem: String,
        options: [String],
        answer: String,
        explanation: String,
        type: String,
        source: String
    ) throws -> ImportedQuestionDraft {
        try makeDraft(
            rowNumber: rowNumber,
            stem: stem,
            options: options,
            answer: answer,
            explanation: explanation,
            type: type,
            source: source,
            errorFactory: QuestionImportError.invalidJSON
        )
    }
}

private enum DOCXTextExtractor {
    static func extractText(from url: URL) throws -> String {
        let data = try Data(contentsOf: url)
        guard !data.isEmpty else {
            throw QuestionImportError.emptyFile
        }

        guard let xmlData = try findStoredZIPEntry(named: "word/document.xml", in: data) else {
            throw QuestionImportError.invalidDOCX(
                "没有找到 word/document.xml。当前内置解析器只支持未压缩存储的 docx；大多数 Word 文件会压缩 XML，需要接入 ZIPFoundation 后才能完整支持。"
            )
        }

        guard let xml = String(data: xmlData, encoding: .utf8) else {
            throw QuestionImportError.invalidDOCX("无法读取 document.xml 文本。")
        }

        let text = xmlToPlainText(xml)
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw QuestionImportError.invalidDOCX("没有从 docx 中提取到文字内容。")
        }

        return text
    }

    private static func findStoredZIPEntry(named entryName: String, in data: Data) throws -> Data? {
        var offset = 0

        while offset + 30 < data.count {
            let signature = data.uint32(at: offset)
            guard signature == 0x04034B50 else {
                break
            }

            let compressionMethod = data.uint16(at: offset + 8)
            let compressedSize = Int(data.uint32(at: offset + 18))
            let uncompressedSize = Int(data.uint32(at: offset + 22))
            let fileNameLength = Int(data.uint16(at: offset + 26))
            let extraFieldLength = Int(data.uint16(at: offset + 28))
            let fileNameStart = offset + 30
            let fileNameEnd = fileNameStart + fileNameLength
            let contentStart = fileNameEnd + extraFieldLength
            let contentEnd = contentStart + compressedSize

            guard fileNameEnd <= data.count, contentEnd <= data.count else {
                throw QuestionImportError.invalidDOCX("docx 文件结构不完整。")
            }

            let fileNameData = data.subdata(in: fileNameStart..<fileNameEnd)
            let fileName = String(data: fileNameData, encoding: .utf8)

            if fileName == entryName {
                guard compressionMethod == 0 else {
                    throw QuestionImportError.invalidDOCX(
                        "已找到文字内容，但该 docx 使用了 ZIP 压缩方式。建议先转成 txt/json/csv，或下一步接入 ZIPFoundation 在 App 内解压。"
                    )
                }

                guard compressedSize == uncompressedSize else {
                    throw QuestionImportError.invalidDOCX("docx 条目大小异常。")
                }

                return data.subdata(in: contentStart..<contentEnd)
            }

            offset = contentEnd
        }

        return nil
    }

    private static func xmlToPlainText(_ xml: String) -> String {
        xml
            .replacingOccurrences(of: "</w:p>", with: "\n")
            .replacingOccurrences(of: "</w:tr>", with: "\n")
            .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&apos;", with: "'")
    }
}

private extension String.Encoding {
    static let gb18030 = String.Encoding(rawValue: CFStringConvertEncodingToNSStringEncoding(CFStringEncoding(CFStringEncodings.GB_18030_2000.rawValue)))
}

private extension Data {
    func uint16(at offset: Int) -> UInt16 {
        let value = self[offset..<offset + 2].enumerated().reduce(UInt16(0)) { result, item in
            result | UInt16(item.element) << UInt16(item.offset * 8)
        }
        return value
    }

    func uint32(at offset: Int) -> UInt32 {
        let value = self[offset..<offset + 4].enumerated().reduce(UInt32(0)) { result, item in
            result | UInt32(item.element) << UInt32(item.offset * 8)
        }
        return value
    }
}
