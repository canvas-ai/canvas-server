export default [
  /*
   * IGNORES
   */
  {
    ignores: [],

    /*
     * LANGUAGE OPTIONS
     */
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },

    /*
     * EXTENDS
     */
    extends: [
      "eslint:recommended",
      "prettier"
    ],

    /*
     * RULES
     */
    rules: {}
  }
];
