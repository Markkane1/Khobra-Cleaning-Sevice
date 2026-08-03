import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    ignores: [".next/**", "node_modules/**", "dist/**"]
  },
  {
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off"
    }
  }
];
