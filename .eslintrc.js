/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "unused-imports", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier"
  ],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "import/order": [
      "warn",
      {
        "groups": ["builtin", "external", "internal"],
        "alphabetize": { order: "asc", caseInsensitive: true }
      }
    ]
  },
  overrides: [
    {
      files: ["*.ts"],
      parserOptions: {
        project: "./tsconfig.json"
      }
    }
  ]
};
