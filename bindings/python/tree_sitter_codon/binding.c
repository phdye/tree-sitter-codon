/**
 * Tree-sitter Codon Python binding.
 * 
 * This module exposes the Codon tree-sitter language to Python.
 */

#include <Python.h>

// Forward declaration - implemented in parser.c
const void *tree_sitter_codon(void);

static PyObject *
py_language(PyObject *self, PyObject *args)
{
    return PyCapsule_New((void *)tree_sitter_codon(), "tree_sitter.Language", NULL);
}

static PyMethodDef module_methods[] = {
    {"language", py_language, METH_NOARGS,
     "Get the tree-sitter Language object for Codon."},
    {NULL, NULL, 0, NULL}
};

static struct PyModuleDef module_def = {
    PyModuleDef_HEAD_INIT,
    "_binding",
    "Codon tree-sitter grammar binding",
    -1,
    module_methods,
    NULL,
    NULL,
    NULL,
    NULL
};

PyMODINIT_FUNC
PyInit__binding(void)
{
    return PyModule_Create(&module_def);
}
