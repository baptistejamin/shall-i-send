/*
 * This file is part of shall-i-send
 *
 * Copyright (c) 2026 Baptiste Jamin
 * All rights reserved
 */

export default {
  preset : "ts-jest",
  testEnvironment : "node",
  testMatch : ["**/test/suite/*.test.ts"],

  moduleNameMapper : {
    "^@/(.*)$" : "<rootDir>/lib/$1"
  }
};
