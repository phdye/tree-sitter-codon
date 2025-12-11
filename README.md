# tree-sitter-codon

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A [tree-sitter](https://github.com/tree-sitter/tree-sitter) grammar for [Codon](https://github.com/exaloop/codon), the high-performance Python compiler from Exaloop.

## Overview

Codon is a Python compiler that produces native code as fast as C/C++. This grammar enables syntax highlighting, code navigation, and analysis for Codon source files.

### Codon-Specific Features Supported

Beyond standard Python syntax, this grammar supports Codon-specific extensions:

- **Pipe operators**: `|>` and `||>` for data flow pipelines
- **LLVM/Python extern blocks**: `@llvm` and `@python` decorated functions with inline code
- **Static type syntax**: `Int[64]`, `Ptr[float]`, `List[T]`
- **Range expressions**: `1...10` (inclusive range)
- **Directives**: `## codon: key = value`
- **C imports**: `from C import foo: int`
- **Generic type parameters**: `def foo[T](x: T) -> T`
- **Match statements**: Full Python 3.10+ pattern matching

## Installation

### npm (Node.js)

```bash
npm install tree-sitter-codon
```

### pip (Python)

```bash
pip install tree-sitter-codon
```

### Building from Source

```bash
git clone https://github.com/phdyex/tree-sitter-codon.git
cd tree-sitter-codon
npm install
npm run build
```

## Usage

### Python

```python
import tree_sitter_codon
from tree_sitter import Language, Parser

# Get the Codon language
lang = Language(tree_sitter_codon.language())

# Create a parser
parser = Parser(lang)

# Parse some Codon code
source = b'''
@par
for i in range(1000):
    total += process(i)
'''

tree = parser.parse(source)
print(tree.root_node.sexp())
```

### JavaScript/Node.js

```javascript
const Parser = require('tree-sitter');
const Codon = require('tree-sitter-codon');

const parser = new Parser();
parser.setLanguage(Codon);

const source = `
@llvm
def add(a: int, b: int) -> int:
    %tmp = add i64 %a, %b
    ret i64 %tmp
`;

const tree = parser.parse(source);
console.log(tree.rootNode.toString());
```

### CLI

```bash
# Parse a file
tree-sitter parse example.codon

# Generate syntax tree
tree-sitter parse --stat example.codon

# Run in playground
npm run start
```

## Grammar Highlights

### Pipe Expressions

Codon's pipe operators enable functional data flow:

```python
# Forward pipe
data |> process |> filter |> output

# Parallel pipe
items ||> expensive_computation
```

### Extern Blocks

Inline LLVM IR or Python code:

```python
@llvm
def fast_add(a: int, b: int) -> int:
    %result = add i64 %a, %b
    ret i64 %result

@python
def use_numpy(arr):
    import numpy as np
    return np.sum(arr)
```

### Generic Types

```python
def identity[T](x: T) -> T:
    return x

class Container[T]:
    value: T
```

### Range Expressions

```python
# Inclusive range
for i in 1...10:
    print(i)
```

## Development

### Generate Parser

```bash
npm run generate
```

### Run Tests

```bash
npm test
```

### Build WASM

```bash
npm run build-wasm
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Adding Tests

Test cases go in `test/corpus/`. Each file contains test cases in this format:

```
================================================================================
Test Name
================================================================================

source code here

--------------------------------------------------------------------------------

(expected_syntax_tree)

================================================================================
```

## License

Apache License 2.0

## Related Projects

- [Codon](https://github.com/exaloop/codon) - The Codon compiler
- [tree-sitter](https://github.com/tree-sitter/tree-sitter) - Parser generator
- [tree-sitter-python](https://github.com/tree-sitter/tree-sitter-python) - Python grammar (inspiration)

## References

- [Codon Documentation](https://docs.exaloop.io/)
- [Codon Paper (CC'23)](https://dl.acm.org/doi/10.1145/3578360.3580275)
- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
