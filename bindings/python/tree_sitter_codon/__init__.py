"""
Tree-sitter Codon grammar bindings for Python.

Codon is a high-performance Python compiler from Exaloop.
https://docs.exaloop.io/
"""

from importlib.resources import files as _files

from ._binding import language as _language


def _get_query(name: str, filename: str) -> str:
    """Load a query file from the queries directory."""
    query_path = _files("tree_sitter_codon") / "queries" / filename
    return query_path.read_text()


def language():
    """Get the tree-sitter Language object for Codon.
    
    Returns:
        A tree-sitter Language object that can be used to create a Parser.
    
    Example:
        >>> import tree_sitter_codon
        >>> from tree_sitter import Language, Parser
        >>> lang = Language(tree_sitter_codon.language())
        >>> parser = Parser(lang)
        >>> tree = parser.parse(b"def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)")
    """
    return _language()


__all__ = ["language"]
__version__ = "0.1.0"
