/**
 * Tree-sitter external scanner for Codon.
 * 
 * Handles Python-like indentation-sensitive parsing:
 * - NEWLINE tokens
 * - INDENT tokens
 * - DEDENT tokens
 * - String handling (prefix, content, escape sequences)
 * - Extern block content (for @llvm/@python decorators)
 */

#include "tree_sitter/parser.h"
#include "tree_sitter/alloc.h"
#include "tree_sitter/array.h"
#include <wctype.h>
#include <string.h>
#include <stdio.h>

enum TokenType {
    NEWLINE,
    INDENT,
    DEDENT,
    STRING_START,
    STRING_CONTENT,
    ESCAPE_INTERPOLATION,
    STRING_END,
    EXTERN_CONTENT,
    PREC,
};

typedef struct {
    Array(uint16_t) indents;
    Array(int32_t) delimiters;
    bool inside_f_string;
} Scanner;

static inline void advance(TSLexer *lexer) { lexer->advance(lexer, false); }
static inline void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

static inline bool is_space(int32_t c) {
    return c == ' ' || c == '\t';
}

static inline bool is_newline(int32_t c) {
    return c == '\n' || c == '\r';
}

void *tree_sitter_codon_external_scanner_create(void) {
    Scanner *scanner = ts_calloc(1, sizeof(Scanner));
    array_init(&scanner->indents);
    array_init(&scanner->delimiters);
    scanner->inside_f_string = false;
    return scanner;
}

void tree_sitter_codon_external_scanner_destroy(void *payload) {
    Scanner *scanner = (Scanner *)payload;
    array_delete(&scanner->indents);
    array_delete(&scanner->delimiters);
    ts_free(scanner);
}

unsigned tree_sitter_codon_external_scanner_serialize(void *payload, char *buffer) {
    Scanner *scanner = (Scanner *)payload;
    unsigned size = 0;
    
    // Serialize indent count
    uint32_t indent_count = scanner->indents.size;
    if (size + sizeof(uint32_t) > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) return 0;
    memcpy(&buffer[size], &indent_count, sizeof(uint32_t));
    size += sizeof(uint32_t);
    
    // Serialize indents
    for (uint32_t i = 0; i < indent_count; i++) {
        if (size + sizeof(uint16_t) > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) return 0;
        uint16_t indent = *array_get(&scanner->indents, i);
        memcpy(&buffer[size], &indent, sizeof(uint16_t));
        size += sizeof(uint16_t);
    }
    
    // Serialize delimiter count
    uint32_t delim_count = scanner->delimiters.size;
    if (size + sizeof(uint32_t) > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) return 0;
    memcpy(&buffer[size], &delim_count, sizeof(uint32_t));
    size += sizeof(uint32_t);
    
    // Serialize delimiters
    for (uint32_t i = 0; i < delim_count; i++) {
        if (size + sizeof(int32_t) > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) return 0;
        int32_t delim = *array_get(&scanner->delimiters, i);
        memcpy(&buffer[size], &delim, sizeof(int32_t));
        size += sizeof(int32_t);
    }
    
    // Serialize f-string state
    if (size + 1 > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) return 0;
    buffer[size++] = scanner->inside_f_string ? 1 : 0;
    
    return size;
}

void tree_sitter_codon_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
    Scanner *scanner = (Scanner *)payload;
    array_clear(&scanner->indents);
    array_clear(&scanner->delimiters);
    scanner->inside_f_string = false;
    
    if (length == 0) return;
    
    unsigned size = 0;
    
    // Deserialize indent count
    if (size + sizeof(uint32_t) > length) return;
    uint32_t indent_count;
    memcpy(&indent_count, &buffer[size], sizeof(uint32_t));
    size += sizeof(uint32_t);
    
    // Deserialize indents
    for (uint32_t i = 0; i < indent_count; i++) {
        if (size + sizeof(uint16_t) > length) return;
        uint16_t indent;
        memcpy(&indent, &buffer[size], sizeof(uint16_t));
        size += sizeof(uint16_t);
        array_push(&scanner->indents, indent);
    }
    
    // Deserialize delimiter count
    if (size + sizeof(uint32_t) > length) return;
    uint32_t delim_count;
    memcpy(&delim_count, &buffer[size], sizeof(uint32_t));
    size += sizeof(uint32_t);
    
    // Deserialize delimiters
    for (uint32_t i = 0; i < delim_count; i++) {
        if (size + sizeof(int32_t) > length) return;
        int32_t delim;
        memcpy(&delim, &buffer[size], sizeof(int32_t));
        size += sizeof(int32_t);
        array_push(&scanner->delimiters, delim);
    }
    
    // Deserialize f-string state
    if (size + 1 <= length) {
        scanner->inside_f_string = buffer[size++] == 1;
    }
}

static bool scan_newline(Scanner *scanner, TSLexer *lexer, const bool *valid_symbols) {
    // Skip whitespace and comments until newline
    while (is_space(lexer->lookahead)) {
        skip(lexer);
    }
    
    // Check for comment
    if (lexer->lookahead == '#') {
        while (lexer->lookahead != '\n' && lexer->lookahead != '\r' && lexer->lookahead != 0) {
            skip(lexer);
        }
    }
    
    if (!is_newline(lexer->lookahead)) {
        return false;
    }
    
    // Consume newline
    advance(lexer);
    if (lexer->lookahead == '\n') {
        advance(lexer);
    }
    
    lexer->result_symbol = NEWLINE;
    lexer->mark_end(lexer);
    
    // Count indentation
    uint32_t indent = 0;
    while (is_space(lexer->lookahead)) {
        indent++;
        skip(lexer);
    }
    
    // Skip blank lines and comments
    while (is_newline(lexer->lookahead) || lexer->lookahead == '#') {
        if (lexer->lookahead == '#') {
            while (!is_newline(lexer->lookahead) && lexer->lookahead != 0) {
                skip(lexer);
            }
        }
        if (is_newline(lexer->lookahead)) {
            skip(lexer);
            if (lexer->lookahead == '\n') {
                skip(lexer);
            }
        }
        indent = 0;
        while (is_space(lexer->lookahead)) {
            indent++;
            skip(lexer);
        }
    }
    
    // Determine if this is an INDENT, DEDENT, or just a NEWLINE
    uint16_t current_indent = scanner->indents.size > 0 
        ? *array_back(&scanner->indents) 
        : 0;
    
    if (indent > current_indent && valid_symbols[INDENT]) {
        array_push(&scanner->indents, indent);
        lexer->result_symbol = INDENT;
        return true;
    }
    
    if (indent < current_indent && valid_symbols[DEDENT]) {
        array_pop(&scanner->indents);
        lexer->result_symbol = DEDENT;
        return true;
    }
    
    return valid_symbols[NEWLINE];
}

static bool scan_string(Scanner *scanner, TSLexer *lexer, const bool *valid_symbols) {
    int32_t quote_char = 0;
    bool is_triple = false;
    bool is_raw = false;
    bool is_format = false;
    bool is_bytes = false;
    
    // Check for string prefix
    if (valid_symbols[STRING_START]) {
        // Check for prefix characters: r, R, f, F, b, B, u, U
        while (true) {
            int32_t c = lexer->lookahead;
            if (c == 'r' || c == 'R') {
                is_raw = true;
                advance(lexer);
            } else if (c == 'f' || c == 'F') {
                is_format = true;
                advance(lexer);
            } else if (c == 'b' || c == 'B') {
                is_bytes = true;
                advance(lexer);
            } else if (c == 'u' || c == 'U') {
                advance(lexer);
            } else {
                break;
            }
        }
        
        // Check for quote
        if (lexer->lookahead == '"' || lexer->lookahead == '\'') {
            quote_char = lexer->lookahead;
            advance(lexer);
            
            // Check for triple quote
            if (lexer->lookahead == quote_char) {
                advance(lexer);
                if (lexer->lookahead == quote_char) {
                    advance(lexer);
                    is_triple = true;
                } else {
                    // Empty string ""
                    lexer->mark_end(lexer);
                    lexer->result_symbol = STRING_START;
                    return true;
                }
            }
            
            lexer->mark_end(lexer);
            lexer->result_symbol = STRING_START;
            
            // Push delimiter for tracking
            int32_t delim = quote_char | (is_triple ? 0x100 : 0) | (is_raw ? 0x200 : 0) | (is_format ? 0x400 : 0);
            array_push(&scanner->delimiters, delim);
            scanner->inside_f_string = is_format;
            
            return true;
        }
    }
    
    // Scan string content
    if (valid_symbols[STRING_CONTENT] && scanner->delimiters.size > 0) {
        int32_t delim = *array_back(&scanner->delimiters);
        quote_char = delim & 0xFF;
        is_triple = (delim & 0x100) != 0;
        is_raw = (delim & 0x200) != 0;
        is_format = (delim & 0x400) != 0;
        
        bool has_content = false;
        
        while (true) {
            if (lexer->lookahead == 0) {
                break;
            }
            
            // Check for end of string
            if (lexer->lookahead == quote_char) {
                if (is_triple) {
                    lexer->mark_end(lexer);
                    advance(lexer);
                    if (lexer->lookahead == quote_char) {
                        advance(lexer);
                        if (lexer->lookahead == quote_char) {
                            // End of triple-quoted string
                            if (has_content) {
                                lexer->result_symbol = STRING_CONTENT;
                                return true;
                            }
                            break;
                        }
                    }
                    has_content = true;
                    continue;
                } else {
                    // End of single-quoted string
                    break;
                }
            }
            
            // Check for newline in non-triple string
            if (!is_triple && is_newline(lexer->lookahead)) {
                break;
            }
            
            // Check for interpolation in f-string
            if (is_format && lexer->lookahead == '{') {
                if (has_content) {
                    lexer->mark_end(lexer);
                    lexer->result_symbol = STRING_CONTENT;
                    return true;
                }
                advance(lexer);
                if (lexer->lookahead == '{') {
                    // Escaped brace {{
                    advance(lexer);
                    has_content = true;
                    lexer->mark_end(lexer);
                    lexer->result_symbol = ESCAPE_INTERPOLATION;
                    return true;
                }
                // Start of interpolation - handled by grammar
                return false;
            }
            
            // Check for escape sequence
            if (!is_raw && lexer->lookahead == '\\') {
                advance(lexer);
                if (lexer->lookahead != 0) {
                    advance(lexer);
                }
                has_content = true;
                continue;
            }
            
            advance(lexer);
            has_content = true;
        }
        
        if (has_content) {
            lexer->mark_end(lexer);
            lexer->result_symbol = STRING_CONTENT;
            return true;
        }
    }
    
    // Scan string end
    if (valid_symbols[STRING_END] && scanner->delimiters.size > 0) {
        int32_t delim = *array_back(&scanner->delimiters);
        quote_char = delim & 0xFF;
        is_triple = (delim & 0x100) != 0;
        
        if (lexer->lookahead == quote_char) {
            advance(lexer);
            if (is_triple) {
                if (lexer->lookahead == quote_char) {
                    advance(lexer);
                    if (lexer->lookahead == quote_char) {
                        advance(lexer);
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }
            }
            
            lexer->mark_end(lexer);
            lexer->result_symbol = STRING_END;
            array_pop(&scanner->delimiters);
            scanner->inside_f_string = scanner->delimiters.size > 0 && 
                (*array_back(&scanner->delimiters) & 0x400) != 0;
            return true;
        }
    }
    
    return false;
}

bool tree_sitter_codon_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    Scanner *scanner = (Scanner *)payload;
    
    // Handle DEDENT at EOF - emit remaining DEDENTs for unclosed indent levels
    if (valid_symbols[DEDENT] && scanner->indents.size > 0) {
        // Check if we're at EOF or if dedent is needed
        if (lexer->eof(lexer)) {
            array_pop(&scanner->indents);
            lexer->result_symbol = DEDENT;
            return true;
        }
    }
    
    // Handle string tokens first
    if (valid_symbols[STRING_START] || valid_symbols[STRING_CONTENT] || 
        valid_symbols[STRING_END] || valid_symbols[ESCAPE_INTERPOLATION]) {
        if (scan_string(scanner, lexer, valid_symbols)) {
            return true;
        }
    }
    
    // Handle newline/indent/dedent
    if (valid_symbols[NEWLINE] || valid_symbols[INDENT] || valid_symbols[DEDENT]) {
        if (scan_newline(scanner, lexer, valid_symbols)) {
            return true;
        }
    }
    
    return false;
}
