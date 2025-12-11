/**
 * Tree-sitter Codon grammar for Node.js
 * 
 * @module tree-sitter-codon
 */

const path = require("path");
const binding = require("node-gyp-build")(path.dirname(__dirname));

module.exports = binding;
