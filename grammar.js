/**
 * @file Codon grammar for tree-sitter
 * @author Philip Dyex
 * @license Apache-2.0
 *
 * Codon is a high-performance Python compiler from Exaloop.
 * This grammar extends Python syntax with Codon-specific features:
 * - Pipe operators (|>, ||>)
 * - LLVM/Python extern blocks
 * - Static type syntax (Int[N], Ptr[T])
 * - Range expressions (1...10)
 * - Directives (## codon: key = value)
 * - from C import declarations
 * - Custom DSL statements
 *
 * Reference: https://docs.exaloop.io/
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  // Python precedences (for reference)
  parenthesized_expression: 1,
  parenthesized_list_splat: 1,
  or: 4,
  and: 5,
  not: 6,
  compare: 7,
  bitwise_or: 8,
  bitwise_xor: 9,
  bitwise_and: 10,
  shift: 11,
  plus: 12,
  times: 13,
  unary: 14,
  power: 15,
  // Codon-specific
  pipe: 3,  // lower than 'or'
  range: 16,
  call: 17,
};

module.exports = grammar({
  name: 'codon',

  externals: $ => [
    $._newline,
    $._indent,
    $._dedent,
    $.string_start,
    $._string_content,
    $.escape_interpolation,
    $.string_end,

    // Allow external scanner to detect LLVM/Python blocks
    $.extern_content,

    // Mark certain errors
    $.PREC,
  ],

  extras: $ => [
    $.comment,
    /[\s\f\uFEFF\u2060\u200B]|\r?\n|\\\r?\n/,
  ],

  conflicts: $ => [
    [$.primary_expression, $.pattern],
    [$.primary_expression, $.list_splat_pattern],
    [$.tuple, $.tuple_pattern],
    [$.list, $.list_pattern],
    [$.with_item, $._collection_elements],
    [$.named_expression, $.as_pattern],
    [$.print_statement, $.primary_expression],
    [$.type_alias_statement, $.primary_expression],
    // Codon-specific
    [$.pipe_expression, $.comparison_operator],
    // Named expression vs conditional expression
    [$.named_expression, $.conditional_expression],
    // Type parameter constraint vs primary expression in def foo[T: ...]
    [$.type_parameter_constraint, $.primary_expression],
    // if_clause vs conditional_expression in comprehensions
    [$.if_clause, $.conditional_expression],
    // Match statement pattern conflicts
    [$.literal_pattern, $.primary_expression],
    [$.capture_pattern, $.primary_expression],
    [$.case_pattern, $.expression],
    [$.as_pattern, $.expression],
    [$.sequence_pattern, $.tuple],
    [$.sequence_pattern, $.list],
    [$.mapping_pattern, $.dictionary],
    [$.mapping_pattern, $.primary_expression],
    [$.class_pattern, $.call],
    [$.wildcard_pattern, $.identifier],
    // Generator/comprehension conflicts
    [$.for_in_clause, $.conditional_expression],
  ],

  supertypes: $ => [
    $._simple_statement,
    $._compound_statement,
    $.expression,
    $.primary_expression,
    $.pattern,
    $.parameter,
  ],

  inline: $ => [
    $._simple_statement,
    $._compound_statement,
    $._suite,
    $._expressions,
    $._left_hand_side,
    $.keyword_identifier,
  ],

  word: $ => $.identifier,

  rules: {
    module: $ => repeat($._statement),

    _statement: $ => choice(
      $._simple_statements,
      $._compound_statement,
    ),

    // Simple statements
    _simple_statements: $ => seq(
      sep1($._simple_statement, ';'),
      optional(';'),
      $._newline,
    ),

    _simple_statement: $ => choice(
      $.future_import_statement,
      $.import_statement,
      $.import_from_statement,
      $.print_statement,
      $.assert_statement,
      $.expression_statement,
      $.return_statement,
      $.delete_statement,
      $.raise_statement,
      $.pass_statement,
      $.break_statement,
      $.continue_statement,
      $.global_statement,
      $.nonlocal_statement,
      $.exec_statement,
      $.type_alias_statement,
      // Codon-specific
      $.directive,
      // Note: custom_small_statement removed - requires compiler-side keyword registration
    ),

    // Codon directive: ## codon: key = value
    directive: $ => seq(
      '##',
      'codon:',
      field('key', $.identifier),
      '=',
      field('value', choice($.integer, $.identifier)),
    ),

    import_statement: $ => seq(
      'import',
      $._import_list,
    ),

    import_prefix: $ => repeat1('.'),

    relative_import: $ => seq(
      $.import_prefix,
      optional($.dotted_name),
    ),

    future_import_statement: $ => seq(
      'from',
      '__future__',
      'import',
      choice(
        $._import_list,
        seq('(', $._import_list, ')'),
      ),
    ),

    import_from_statement: $ => seq(
      'from',
      field('module_name', choice(
        $.relative_import,
        $.dotted_name,
        // Codon: from C import
        'C',
        'python',
      )),
      'import',
      choice(
        $.wildcard_import,
        $._import_list,
        seq('(', $._import_list, ')'),
      ),
    ),

    _import_list: $ => seq(
      commaSep1(field('name', choice(
        $.dotted_name,
        $.aliased_import,
        // Codon: typed C imports like `foo: int`
        $.c_typed_import,
      ))),
      optional(','),
    ),

    // Codon: from C import foo: int
    c_typed_import: $ => seq(
      field('name', $.dotted_name),
      ':',
      field('type', $.type),
    ),

    aliased_import: $ => seq(
      field('name', $.dotted_name),
      'as',
      field('alias', $.identifier),
    ),

    wildcard_import: $ => '*',

    print_statement: $ => choice(
      prec(1, seq(
        'print',
        $.chevron,
        repeat(seq(',', field('argument', $.expression))),
        optional(','),
      )),
      prec(-3, prec.dynamic(-1, seq(
        'print',
        commaSep1(field('argument', $.expression)),
        optional(','),
      ))),
    ),

    chevron: $ => seq(
      '>>',
      $.expression,
    ),

    assert_statement: $ => seq(
      'assert',
      commaSep1($.expression),
    ),

    expression_statement: $ => choice(
      $.expression,
      seq(commaSep1($.expression), optional(',')),
      $.assignment,
      $.augmented_assignment,
      $.yield,
    ),

    named_expression: $ => seq(
      field('name', $._named_expression_lhs),
      ':=',
      field('value', $.expression),
    ),

    _named_expression_lhs: $ => $.identifier,

    return_statement: $ => seq(
      'return',
      optional($._expressions),
    ),

    delete_statement: $ => seq(
      'del',
      $._expressions,
    ),

    _expressions: $ => choice(
      $.expression,
      $.expression_list,
    ),

    raise_statement: $ => seq(
      'raise',
      optional($._expressions),
      optional(seq('from', field('cause', $.expression))),
    ),

    pass_statement: $ => prec.left('pass'),
    break_statement: $ => prec.left('break'),
    continue_statement: $ => prec.left('continue'),

    // Compound statements
    _compound_statement: $ => choice(
      $.if_statement,
      $.for_statement,
      $.while_statement,
      $.try_statement,
      $.with_statement,
      $.function_definition,
      $.class_definition,
      $.decorated_definition,
      $.match_statement,
      // Note: custom_statement removed - requires compiler-side keyword registration
    ),

    // Codon custom compound statement (DSL extension point)
    // Note: This is intentionally low precedence as it's a fallback for DSL extensions
    custom_statement: $ => prec.dynamic(-10, seq(
      field('keyword', alias($.identifier, $.custom_keyword)),
      optional(field('expression', $.expression)),
      ':',
      field('body', $._suite),
    )),

    if_statement: $ => seq(
      'if',
      field('condition', $.expression),
      ':',
      field('consequence', $._suite),
      repeat(field('alternative', $.elif_clause)),
      optional(field('alternative', $.else_clause)),
    ),

    elif_clause: $ => seq(
      'elif',
      field('condition', $.expression),
      ':',
      field('consequence', $._suite),
    ),

    else_clause: $ => seq(
      'else',
      ':',
      field('body', $._suite),
    ),

    match_statement: $ => seq(
      'match',
      field('subject', commaSep1($.expression)),
      ':',
      repeat1($.case_clause),
    ),

    case_clause: $ => seq(
      'case',
      field('pattern', commaSep1($.case_pattern)),
      optional(field('guard', $.if_clause)),
      ':',
      field('consequence', $._suite),
    ),

    // Pattern rules for match/case
    // _closed_pattern: patterns that don't include or_pattern (avoids left-recursion)
    _closed_pattern: $ => choice(
      $.literal_pattern,
      $.capture_pattern,
      $.wildcard_pattern,
      $.class_pattern,
      $.sequence_pattern,
      $.mapping_pattern,
    ),

    // case_pattern: top-level pattern including or_pattern and as_pattern
    case_pattern: $ => choice(
      $._closed_pattern,
      $.as_pattern,
      $.or_pattern,
    ),

    literal_pattern: $ => choice(
      $.string,
      $.concatenated_string,
      $.integer,
      $.float,
      $.true,
      $.false,
      $.none,
    ),

    capture_pattern: $ => $.identifier,
    wildcard_pattern: $ => '_',

    class_pattern: $ => seq(
      field('class', $.dotted_name),
      '(',
      optional(commaSep1(choice(
        $.keyword_pattern,
        $.positional_pattern,
      ))),
      optional(','),
      ')',
    ),

    positional_pattern: $ => $._closed_pattern,
    keyword_pattern: $ => seq(
      field('name', $.identifier),
      '=',
      field('value', $._closed_pattern),
    ),

    as_pattern: $ => prec(1, seq(
      $._closed_pattern,
      'as',
      field('alias', $.identifier),
    )),

    or_pattern: $ => prec.left(seq(
      $._closed_pattern,
      repeat1(seq('|', $._closed_pattern)),
    )),

    sequence_pattern: $ => choice(
      seq('[', optional(commaSep1($.case_pattern)), optional(','), ']'),
      seq('(', optional(commaSep1($.case_pattern)), optional(','), ')'),
    ),

    mapping_pattern: $ => seq(
      '{',
      optional(commaSep1(choice(
        seq(field('key', choice($.string, $.integer)), ':', field('value', $.case_pattern)),
        seq('**', field('rest', $.identifier)),
      ))),
      optional(','),
      '}',
    ),

    for_statement: $ => seq(
      optional('async'),
      'for',
      field('left', $._left_hand_side),
      'in',
      field('right', $._expressions),
      ':',
      field('body', $._suite),
      optional(field('alternative', $.else_clause)),
    ),

    while_statement: $ => seq(
      'while',
      field('condition', $.expression),
      ':',
      field('body', $._suite),
      optional(field('alternative', $.else_clause)),
    ),

    try_statement: $ => seq(
      'try',
      ':',
      field('body', $._suite),
      choice(
        seq(
          repeat1($.except_clause),
          optional($.else_clause),
          optional($.finally_clause),
        ),
        seq(
          repeat1($.except_group_clause),
          optional($.else_clause),
          optional($.finally_clause),
        ),
        $.finally_clause,
      ),
    ),

    except_clause: $ => seq(
      'except',
      optional(seq(
        $.expression,
        optional(seq(
          choice('as', ','),
          $.expression,
        )),
      )),
      ':',
      $._suite,
    ),

    except_group_clause: $ => seq(
      'except*',
      seq(
        $.expression,
        optional(seq('as', $.expression)),
      ),
      ':',
      $._suite,
    ),

    finally_clause: $ => seq(
      'finally',
      ':',
      $._suite,
    ),

    with_statement: $ => seq(
      optional('async'),
      'with',
      $.with_clause,
      ':',
      field('body', $._suite),
    ),

    with_clause: $ => choice(
      seq(commaSep1($.with_item), optional(',')),
      seq('(', commaSep1($.with_item), optional(','), ')'),
    ),

    with_item: $ => prec.dynamic(1, seq(
      field('value', $.expression),
    )),

    // Function definitions
    function_definition: $ => seq(
      optional('async'),
      'def',
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameter)),
      field('parameters', $.parameters),
      optional(seq('->', field('return_type', $.type))),
      ':',
      field('body', $._suite),
    ),

    parameters: $ => seq(
      '(',
      optional($._parameters),
      ')',
    ),

    lambda_parameters: $ => $._parameters,

    list_splat: $ => seq(
      '*',
      $.expression,
    ),

    dictionary_splat: $ => seq(
      '**',
      $.expression,
    ),

    global_statement: $ => seq(
      'global',
      commaSep1($.identifier),
    ),

    nonlocal_statement: $ => seq(
      'nonlocal',
      commaSep1($.identifier),
    ),

    exec_statement: $ => seq(
      'exec',
      field('code', choice($.string, $.identifier)),
      optional(seq(
        'in',
        commaSep1($.expression),
      )),
    ),

    type_alias_statement: $ => prec.dynamic(1, seq(
      'type',
      $.type,
      '=',
      $.type,
    )),

    class_definition: $ => seq(
      'class',
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameter)),
      optional(field('superclasses', $.argument_list)),
      ':',
      field('body', $._suite),
    ),

    // Codon: generic type parameters [T, N: int]
    type_parameter: $ => seq(
      '[',
      commaSep1(choice(
        $.type,
        $.type_parameter_constraint,
      )),
      optional(','),
      ']',
    ),

    type_parameter_constraint: $ => seq(
      field('name', $.identifier),
      ':',
      field('constraint', $.type),
    ),

    argument_list: $ => seq(
      '(',
      optional(commaSep1(choice(
        $.expression,
        $.list_splat,
        $.dictionary_splat,
        $.parenthesized_list_splat,
        $.keyword_argument,
      ))),
      optional(','),
      ')',
    ),

    decorated_definition: $ => seq(
      repeat1($.decorator),
      field('definition', choice(
        $.class_definition,
        $.function_definition,
        // Codon: extern decorated function
        $.extern_function,
      )),
    ),

    decorator: $ => seq(
      '@',
      $.expression,
      $._newline,
    ),

    // Codon: @llvm or @python decorated extern function
    extern_function: $ => seq(
      '@',
      field('extern_type', choice('llvm', 'python')),
      $._newline,
      optional('async'),
      'def',
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameter)),
      field('parameters', $.parameters),
      optional(seq('->', field('return_type', $.type))),
      ':',
      field('body', $.extern_block),
    ),

    // Codon: extern block containing LLVM IR or Python code
    extern_block: $ => seq(
      $._indent,
      repeat1($.extern_line),
      $._dedent,
    ),

    extern_line: $ => seq(
      /[^\n]+/,
      $._newline,
    ),

    _suite: $ => choice(
      alias($._simple_statements, $.block),
      seq($._indent, $.block),
      alias($._newline, $.block),
    ),

    block: $ => seq(
      repeat($._statement),
      $._dedent,
    ),

    expression_list: $ => prec.right(seq(
      $.expression,
      choice(
        ',',
        seq(repeat1(seq(',', $.expression)), optional(',')),
      ),
    )),

    dotted_name: $ => prec(1, sep1($.identifier, '.')),

    // Parameters
    _parameters: $ => seq(
      commaSep1($.parameter),
      optional(','),
    ),

    _patterns: $ => seq(
      commaSep1($.pattern),
      optional(','),
    ),

    parameter: $ => choice(
      $.identifier,
      $.typed_parameter,
      $.default_parameter,
      $.typed_default_parameter,
      $.list_splat_pattern,
      $.tuple_pattern,
      $.keyword_separator,
      $.positional_separator,
      $.dictionary_splat_pattern,
    ),

    pattern: $ => choice(
      $.identifier,
      $.keyword_identifier,
      $.subscript,
      $.attribute,
      $.list_splat_pattern,
      $.tuple_pattern,
      $.list_pattern,
    ),

    tuple_pattern: $ => seq(
      '(',
      optional($._patterns),
      ')',
    ),

    list_pattern: $ => seq(
      '[',
      optional($._patterns),
      ']',
    ),

    default_parameter: $ => seq(
      field('name', choice($.identifier, $.tuple_pattern)),
      '=',
      field('value', $.expression),
    ),

    typed_default_parameter: $ => prec(1, seq(
      field('name', $.identifier),
      ':',
      field('type', $.type),
      '=',
      field('value', $.expression),
    )),

    list_splat_pattern: $ => seq(
      '*',
      choice($.identifier, $.keyword_identifier, $.subscript, $.attribute),
    ),

    dictionary_splat_pattern: $ => seq(
      '**',
      choice($.identifier, $.keyword_identifier, $.subscript, $.attribute),
    ),

    // Extended patterns
    as_pattern: $ => prec.left(seq(
      $.expression,
      'as',
      field('alias', alias($.expression, $.as_pattern_target)),
    )),

    // Expression grammar
    expression: $ => choice(
      $.comparison_operator,
      $.not_operator,
      $.boolean_operator,
      $.await,
      $.lambda,
      $.primary_expression,
      $.conditional_expression,
      $.named_expression,
      $.as_pattern,
      // Codon-specific
      $.pipe_expression,
    ),

    // Codon: pipe expression (a |> b, a ||> b)
    pipe_expression: $ => prec.left(PREC.pipe, seq(
      field('left', $.expression),
      field('operator', choice('|>', '||>')),
      field('right', $.expression),
    )),

    primary_expression: $ => choice(
      $.binary_operator,
      $.identifier,
      $.keyword_identifier,
      $.string,
      $.concatenated_string,
      $.integer,
      $.float,
      $.true,
      $.false,
      $.none,
      $.unary_operator,
      $.attribute,
      $.subscript,
      $.call,
      $.list,
      $.list_comprehension,
      $.dictionary,
      $.dictionary_comprehension,
      $.set,
      $.set_comprehension,
      $.tuple,
      $.parenthesized_expression,
      $.generator_expression,
      $.ellipsis,
      // Codon-specific
      $.range_expression,
    ),

    // Codon: range expression (1...10)
    range_expression: $ => prec(PREC.range, seq(
      field('start', $.integer),
      '...',
      field('end', $.integer),
    )),

    not_operator: $ => prec(PREC.not, seq(
      'not',
      field('argument', $.expression),
    )),

    boolean_operator: $ => choice(
      prec.left(PREC.and, seq(
        field('left', $.expression),
        field('operator', 'and'),
        field('right', $.expression),
      )),
      prec.left(PREC.or, seq(
        field('left', $.expression),
        field('operator', 'or'),
        field('right', $.expression),
      )),
    ),

    binary_operator: $ => {
      const table = [
        [prec.left, '+', PREC.plus],
        [prec.left, '-', PREC.plus],
        [prec.left, '*', PREC.times],
        [prec.left, '@', PREC.times],
        [prec.left, '/', PREC.times],
        [prec.left, '%', PREC.times],
        [prec.left, '//', PREC.times],
        [prec.right, '**', PREC.power],
        [prec.left, '|', PREC.bitwise_or],
        [prec.left, '&', PREC.bitwise_and],
        [prec.left, '^', PREC.bitwise_xor],
        [prec.left, '<<', PREC.shift],
        [prec.left, '>>', PREC.shift],
      ];

      return choice(...table.map(([fn, operator, precedence]) => fn(precedence, seq(
        field('left', $.primary_expression),
        field('operator', operator),
        field('right', $.primary_expression),
      ))));
    },

    unary_operator: $ => prec(PREC.unary, seq(
      field('operator', choice('+', '-', '~')),
      field('argument', $.primary_expression),
    )),

    comparison_operator: $ => prec.left(PREC.compare, seq(
      $.primary_expression,
      repeat1(seq(
        field('operators', choice(
          '<', '<=', '==', '!=', '>=', '>', '<>',
          'in', seq('not', 'in'),
          'is', seq('is', 'not'),
        )),
        $.primary_expression,
      )),
    )),

    lambda: $ => prec(1, seq(
      'lambda',
      field('parameters', optional($.lambda_parameters)),
      ':',
      field('body', $.expression),
    )),

    assignment: $ => seq(
      field('left', $._left_hand_side),
      choice(
        seq('=', field('right', $._right_hand_side)),
        seq(':', field('type', $.type)),
        seq(':', field('type', $.type), '=', field('right', $._right_hand_side)),
      ),
    ),

    augmented_assignment: $ => seq(
      field('left', $._left_hand_side),
      field('operator', choice(
        '+=', '-=', '*=', '/=', '@=', '//=', '%=', '**=',
        '>>=', '<<=', '&=', '^=', '|=',
      )),
      field('right', $._right_hand_side),
    ),

    _left_hand_side: $ => choice(
      $.pattern,
      $.pattern_list,
    ),

    pattern_list: $ => seq(
      $.pattern,
      choice(
        ',',
        seq(repeat1(seq(',', $.pattern)), optional(',')),
      ),
    ),

    _right_hand_side: $ => choice(
      $.expression,
      $.expression_list,
      $.assignment,
      $.augmented_assignment,
      $.pattern_list,
      $.yield,
    ),

    yield: $ => prec.right(seq(
      'yield',
      choice(
        seq('from', $.expression),
        optional($._expressions),
      ),
    )),

    attribute: $ => prec(PREC.call, seq(
      field('object', $.primary_expression),
      '.',
      field('attribute', $.identifier),
    )),

    subscript: $ => prec(PREC.call, seq(
      field('value', $.primary_expression),
      '[',
      commaSep1(field('subscript', choice($.expression, $.slice))),
      optional(','),
      ']',
    )),

    slice: $ => seq(
      optional($.expression),
      ':',
      optional($.expression),
      optional(seq(':', optional($.expression))),
    ),

    call: $ => prec(PREC.call, seq(
      field('function', $.primary_expression),
      field('arguments', choice(
        $.generator_expression,
        $.argument_list,
      )),
    )),

    typed_parameter: $ => prec(1, seq(
      choice(
        $.identifier,
        $.list_splat_pattern,
        $.dictionary_splat_pattern,
      ),
      ':',
      field('type', $.type),
    )),

    // Types
    type: $ => choice(
      $.expression,
      $.splat_type,
      $.generic_type,
      $.union_type,
      $.constrained_type,
      $.member_type,
    ),

    splat_type: $ => prec(1, seq(
      choice('*', '**'),
      $.identifier,
    )),

    // Codon: Generic types like List[int], Dict[str, int], Int[64], Ptr[float]
    generic_type: $ => prec(1, seq(
      $.identifier,
      $.type_parameter,
    )),

    union_type: $ => prec.left(seq(
      $.type,
      '|',
      $.type,
    )),

    constrained_type: $ => prec.right(seq(
      $.type,
      ':',
      $.type,
    )),

    member_type: $ => seq(
      $.type,
      '.',
      $.identifier,
    ),

    keyword_argument: $ => seq(
      field('name', choice($.identifier, $.keyword_identifier)),
      '=',
      field('value', $.expression),
    ),

    // Collections
    list: $ => seq(
      '[',
      optional($._collection_elements),
      ']',
    ),

    set: $ => seq(
      '{',
      $._collection_elements,
      '}',
    ),

    tuple: $ => seq(
      '(',
      optional($._collection_elements),
      ')',
    ),

    dictionary: $ => seq(
      '{',
      optional(commaSep1(choice($.pair, $.dictionary_splat))),
      optional(','),
      '}',
    ),

    pair: $ => seq(
      field('key', $.expression),
      ':',
      field('value', $.expression),
    ),

    list_comprehension: $ => seq(
      '[',
      field('body', $.expression),
      $._comprehension_clauses,
      ']',
    ),

    dictionary_comprehension: $ => seq(
      '{',
      field('body', $.pair),
      $._comprehension_clauses,
      '}',
    ),

    set_comprehension: $ => seq(
      '{',
      field('body', $.expression),
      $._comprehension_clauses,
      '}',
    ),

    generator_expression: $ => seq(
      '(',
      field('body', $.expression),
      $._comprehension_clauses,
      ')',
    ),

    _comprehension_clauses: $ => seq(
      $.for_in_clause,
      repeat(choice(
        $.for_in_clause,
        $.if_clause,
      )),
    ),

    parenthesized_expression: $ => prec(PREC.parenthesized_expression, seq(
      '(',
      choice($.expression, $.yield),
      ')',
    )),

    _collection_elements: $ => seq(
      commaSep1(choice(
        $.expression,
        $.yield,
        $.list_splat,
        $.parenthesized_list_splat,
      )),
      optional(','),
    ),

    parenthesized_list_splat: $ => prec(PREC.parenthesized_list_splat, seq(
      '(',
      choice(
        $.parenthesized_list_splat,
        $.list_splat,
      ),
      ')',
    )),

    for_in_clause: $ => prec.left(seq(
      optional('async'),
      'for',
      field('left', $._left_hand_side),
      'in',
      field('right', commaSep1($.expression)),
      optional(','),
    )),

    if_clause: $ => seq(
      'if',
      $.expression,
    ),

    conditional_expression: $ => prec.right(seq(
      $.expression,
      'if',
      $.expression,
      'else',
      $.expression,
    )),

    // Literals
    concatenated_string: $ => seq(
      $.string,
      repeat1($.string),
    ),

    string: $ => seq(
      $.string_start,
      repeat(choice($.interpolation, $._string_content)),
      $.string_end,
    ),

    interpolation: $ => seq(
      '{',
      field('expression', $._f_expression),
      optional('='),
      optional($.type_conversion),
      optional($.format_specifier),
      '}',
    ),

    _f_expression: $ => choice(
      $.expression,
      $.expression_list,
      $.pattern_list,
      $.yield,
    ),

    type_conversion: $ => /![a-z]/,

    format_specifier: $ => seq(
      ':',
      repeat(choice(
        token(prec(1, /[^{}\n]+/)),
        alias($.interpolation, $.format_expression),
      )),
    ),

    await: $ => prec(PREC.unary, seq(
      'await',
      $.primary_expression,
    )),

    positional_separator: $ => '/',
    keyword_separator: $ => '*',

    // Literals
    true: $ => 'True',
    false: $ => 'False',
    none: $ => 'None',

    integer: $ => token(choice(
      seq(
        choice('0x', '0X'),
        repeat1(/_?[A-Fa-f0-9]+/),
        optional(/[Ll]/),
      ),
      seq(
        choice('0o', '0O'),
        repeat1(/_?[0-7]+/),
        optional(/[Ll]/),
      ),
      seq(
        choice('0b', '0B'),
        repeat1(/_?[0-1]+/),
        optional(/[Ll]/),
      ),
      seq(
        repeat1(/[0-9]+_?/),
        choice(
          optional(/[Ll]/),
          optional(/[jJ]/),
        ),
      ),
    )),

    float: $ => {
      const digits = repeat1(/[0-9]+_?/);
      const exponent = seq(/[eE][\+-]?/, digits);
      return token(seq(
        choice(
          // Changed: require digits after '.' to avoid matching "1." in "1...10"
          seq(digits, '.', digits, optional(exponent)),
          seq(optional(digits), '.', digits, optional(exponent)),
          seq(digits, exponent),
        ),
        optional(/[jJ]/),
      ));
    },

    identifier: $ => /[_\p{XID_Start}][_\p{XID_Continue}]*/u,

    keyword_identifier: $ => prec(-3, alias(
      choice(
        'print',
        'exec',
        'async',
        'await',
        'match',
        'type',
      ),
      $.identifier,
    )),

    comment: $ => token(seq('#', /.*/)),

    line_continuation: $ => token(seq('\\', choice(seq(optional('\r'), '\n'), '\0'))),

    ellipsis: $ => '...',
  },
});

module.exports.PREC = PREC;

/**
 * Creates a rule to match one or more of the rules separated by a comma
 */
function commaSep1(rule) {
  return sep1(rule, ',');
}

/**
 * Creates a rule to match one or more occurrences of `rule` separated by `sep`
 */
function sep1(rule, sep) {
  return seq(rule, repeat(seq(sep, rule)));
}
