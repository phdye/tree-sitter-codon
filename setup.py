from setuptools import Extension, setup
from setuptools.command.build_ext import build_ext
from pathlib import Path
import subprocess
import sys

class TreeSitterBuildExt(build_ext):
    """Custom build command to generate parser before building."""
    
    def run(self):
        # Generate the parser if src/parser.c doesn't exist
        parser_c = Path("src/parser.c")
        if not parser_c.exists():
            subprocess.run(
                [sys.executable, "-m", "tree_sitter_cli", "generate"],
                check=True,
            )
        super().run()


setup(
    name="tree-sitter-codon",
    version="0.1.0",
    description="Codon grammar for tree-sitter",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="Philip Dyex",
    license="Apache-2.0",
    url="https://github.com/phdyex/tree-sitter-codon",
    project_urls={
        "Homepage": "https://github.com/phdyex/tree-sitter-codon",
        "Documentation": "https://docs.exaloop.io/",
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: Apache Software License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Compilers",
        "Topic :: Text Processing :: Linguistic",
    ],
    python_requires=">=3.10",
    packages=["tree_sitter_codon"],
    package_dir={"tree_sitter_codon": "bindings/python/tree_sitter_codon"},
    ext_modules=[
        Extension(
            name="tree_sitter_codon._binding",
            sources=[
                "bindings/python/tree_sitter_codon/binding.c",
                "src/parser.c",
                "src/scanner.c",
            ],
            extra_compile_args=["-std=c11"] if sys.platform != "win32" else [],
            define_macros=[
                ("Py_LIMITED_API", "0x03090000"),
                ("PY_SSIZE_T_CLEAN", None),
            ],
            include_dirs=["src"],
            py_limited_api=True,
        )
    ],
    cmdclass={"build_ext": TreeSitterBuildExt},
    install_requires=["tree-sitter>=0.23,<1.0"],
    extras_require={
        "dev": ["tree-sitter-cli>=0.23"],
    },
)
