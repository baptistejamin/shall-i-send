/*
 * This file is part of shall-i-send
 *
 * Copyright (c) 2026 Baptiste Jamin
 * All rights reserved
 */

/**************************************************************************
 * IMPORTS
 ***************************************************************************/

// NPM
import { defineConfig, globalIgnores } from "eslint/config";
import crisp from "eslint-plugin-crisp";
import jest from "eslint-plugin-jest";

/**************************************************************************
 * CONSTANTS
 ***************************************************************************/

const HEADER_PATTERN = (
  "\\n \\* This file is part of .+\\n \\*\\n " +
    "\\* Copyright \\(c\\) \\d{4} Baptiste Jamin\\n \\* All rights reserved\\n "
);

/**************************************************************************
 * CONFIGURATION
 ***************************************************************************/

export default defineConfig([
  globalIgnores([
    "dist/*",
    "node_modules/*"
  ]),

  {
    files: ["lib/**/*.ts", "test/**/*.ts"],
    extends: [crisp.configs["recommended-ts"]],
    rules: {
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "crisp/header-check": ["error", { patterns: [HEADER_PATTERN] }]
    }
  },

  {
    files: ["test/**/*.ts"],
    extends: [jest.configs["flat/recommended"]]
  }
]);
