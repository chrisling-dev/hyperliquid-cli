import { chmodSync, lstatSync, mkdirSync } from "node:fs"

export function secureStateDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 })
  const stat = lstatSync(path)
  if (!stat.isDirectory() || stat.isSymbolicLink() ||
    (process.getuid && stat.uid !== process.getuid()))
    throw new Error("State directory must be a real directory owned by the current user")
  chmodSync(path, 0o700)
}
export function secureStateFile(path: string): void {
  let stat
  try { stat = lstatSync(path) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return
    throw error
  }
  if (!stat.isFile() || stat.isSymbolicLink() ||
    (process.getuid && stat.uid !== process.getuid()))
    throw new Error("State file must be a regular file owned by the current user")
  chmodSync(path, 0o600)
}
