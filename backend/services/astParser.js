const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

/**
 * Parses source code into an Abstract Syntax Tree and flattens it into a
 * sequence of structural node-type tokens (e.g. "IfStatement", "ForStatement",
 * "BinaryExpression", ...).
 *
 * Why this beats raw text diffing: a student who renames every variable,
 * reformats whitespace, or reorders unrelated helper functions produces
 * source text that looks very different but an AST shape that is nearly
 * identical. By discarding identifier names and literal values and keeping
 * only node *types* (plus a few structurally meaningful attributes), we get
 * a sequence that captures "what the code does" rather than "what it's
 * called", which is exactly the kind of copying plagiarism detection needs
 * to survive.
 *
 * @param {string} code
 * @returns {string[] | null} sequence of token strings, or null if the file
 *   could not be parsed (syntax errors, unsupported dialect, etc.)
 */
function extractStructuralSequence(code) {
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'unambiguous',
      allowReturnOutsideFunction: true,
      errorRecovery: true,
      plugins: ['jsx', 'typescript', 'classProperties', 'optionalChaining'],
    });
  } catch (err) {
    return null;
  }

  const sequence = [];

  traverse(ast, {
    enter(path) {
      const node = path.node;

      // Skip pure containers whose children already carry all the signal -
      // including them just adds noise that dilutes real matches.
      if (node.type === 'File' || node.type === 'Program') return;

      let token = node.type;

      // A few node types are more informative if we fold in a coarse
      // structural attribute (operator, kind) without leaking identifier
      // names or literal values - this keeps "a + b" and "x + y" identical
      // while still distinguishing "+" from "-".
      if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression' || node.type === 'AssignmentExpression') {
        token += `:${node.operator}`;
      } else if (node.type === 'VariableDeclaration') {
        token += `:${node.kind}`; // var / let / const
      }

      sequence.push(token);
    },
  });

  return sequence;
}

module.exports = { extractStructuralSequence };
