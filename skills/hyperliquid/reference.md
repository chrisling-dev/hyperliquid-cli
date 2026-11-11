# v1 beta command reference

The installed registry is the authoritative reference. Avoid copying static method tables that drift from the implementation.

```sh
hl --help
hl account --help
hl info --help
hl ws --help
hl exchange --help
hl schema exchange order
hl capabilities --json
```

Use `hl <family> <method> --help` for named flags and `hl schema <family> <method>` for nested input variants. `api-manifest.json` is the reviewed generated snapshot. See the repository README for account permissions, input conventions, core lifecycle, and migration details.
