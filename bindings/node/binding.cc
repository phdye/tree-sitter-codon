/**
 * Tree-sitter Codon Node.js binding
 */

#include <napi.h>

extern "C" const void *tree_sitter_codon();

// "tree-sitter", "language" are Napi::Symbols
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports["name"] = Napi::String::New(env, "codon");
    auto language = Napi::External<void>::New(env, const_cast<void*>(tree_sitter_codon()));
    exports["language"] = language;
    return exports;
}

NODE_API_MODULE(tree_sitter_codon_binding, Init)
