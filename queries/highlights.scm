; Codon syntax highlighting queries for tree-sitter

; Keywords
[
  "and"
  "as"
  "assert"
  "async"
  "await"
  "break"
  "class"
  "continue"
  "def"
  "del"
  "elif"
  "else"
  "except"
  "finally"
  "for"
  "from"
  "global"
  "if"
  "import"
  "in"
  "is"
  "lambda"
  "match"
  "case"
  "nonlocal"
  "not"
  "or"
  "pass"
  "raise"
  "return"
  "try"
  "type"
  "while"
  "with"
  "yield"
] @keyword

; Codon-specific keywords
[
  "llvm"
  "python"
] @keyword.special

; Literals
(none) @constant.builtin
(true) @constant.builtin
(false) @constant.builtin

(integer) @number
(float) @number.float

(string) @string
(escape_sequence) @string.escape
(interpolation) @embedded

(comment) @comment

; Identifiers
(identifier) @variable

; Function definitions
(function_definition
  name: (identifier) @function)

(lambda) @function

; Function calls
(call
  function: (identifier) @function.call)
(call
  function: (attribute
    attribute: (identifier) @function.method.call))

; Class definitions
(class_definition
  name: (identifier) @type.definition)

; Decorators
(decorator) @attribute
(decorator
  (identifier) @attribute)
(decorator
  (call
    function: (identifier) @attribute))

; Codon: extern decorators
(extern_function
  extern_type: _ @keyword.directive)

; Parameters
(parameters
  (identifier) @variable.parameter)
(typed_parameter
  (identifier) @variable.parameter)
(default_parameter
  name: (identifier) @variable.parameter)
(typed_default_parameter
  name: (identifier) @variable.parameter)
(list_splat_pattern
  (identifier) @variable.parameter)
(dictionary_splat_pattern
  (identifier) @variable.parameter)

; Types
(type) @type
(generic_type
  (identifier) @type)
(type_parameter
  (identifier) @type.parameter)

; Attributes
(attribute
  attribute: (identifier) @property)

; Operators
[
  "-"
  "-="
  ":="
  "!="
  "*"
  "**"
  "**="
  "*="
  "/"
  "//"
  "//="
  "/="
  "&"
  "&="
  "%"
  "%="
  "^"
  "^="
  "+"
  "+="
  "<"
  "<<"
  "<<="
  "<="
  "<>"
  "="
  "=="
  ">"
  ">="
  ">>"
  ">>="
  "@"
  "@="
  "|"
  "|="
  "~"
] @operator

; Codon: pipe operators
[
  "|>"
  "||>"
] @operator.pipe

; Delimiters
[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  ","
  "."
  ":"
  ";"
  "->"
] @punctuation.delimiter

; Codon: range operator
"..." @operator.range

; Codon: directive
(directive
  "##" @keyword.directive
  "codon:" @keyword.directive
  key: (identifier) @property
  value: _ @constant)

; Codon: C import
(c_typed_import
  name: (dotted_name) @variable
  type: (type) @type)

; Imports
(import_statement
  (dotted_name) @module)
(import_from_statement
  module_name: (dotted_name) @module)
(aliased_import
  alias: (identifier) @module)

; Special
(ellipsis) @punctuation.special

; Error
(ERROR) @error
