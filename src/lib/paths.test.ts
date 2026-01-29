import { describe, it, expect } from "vitest"
import { homedir } from "node:os"
import { join } from "node:path"
import {
  HL_DIR,
  SERVER_SOCKET_PATH,
  SERVER_PID_PATH,
  SERVER_LOG_PATH,
  SERVER_CONFIG_PATH,
} from "./paths.js"

describe("paths", () => {
  const expectedHlDir = join(homedir(), ".hl")

  it("HL_DIR should be in home directory", () => {
    expect(HL_DIR).toBe(expectedHlDir)
  })

  it("SERVER_SOCKET_PATH should be in HL_DIR", () => {
    expect(SERVER_SOCKET_PATH).toBe(join(expectedHlDir, "server.sock"))
  })

  it("SERVER_PID_PATH should be in HL_DIR", () => {
    expect(SERVER_PID_PATH).toBe(join(expectedHlDir, "server.pid"))
  })

  it("SERVER_LOG_PATH should be in HL_DIR", () => {
    expect(SERVER_LOG_PATH).toBe(join(expectedHlDir, "server.log"))
  })

  it("SERVER_CONFIG_PATH should be in HL_DIR", () => {
    expect(SERVER_CONFIG_PATH).toBe(join(expectedHlDir, "server.json"))
  })
})
