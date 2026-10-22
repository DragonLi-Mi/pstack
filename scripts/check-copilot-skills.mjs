import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [sdkPath, cliPath] = process.argv.slice(2);
assert(sdkPath && cliPath, "Usage: node scripts/check-copilot-skills.mjs <copilot-sdk/index.js> <copilot executable>");
const { CopilotClient, RuntimeConnection } = await import(pathToFileURL(resolve(sdkPath)));
const root = fileURLToPath(new URL("../", import.meta.url));
const baseDirectory = await mkdtemp(join(tmpdir(), "pstack-copilot-loader-"));
const client = new CopilotClient({
  mode: "empty",
  baseDirectory,
  workingDirectory: root,
  connection: RuntimeConnection.forStdio({
    path: resolve(cliPath),
    args: ["--disable-builtin-mcps"],
  }),
});
const normalize = (value) => value.replaceAll("\r\n", "\n").trim();
const failures = [];
let checked = 0;

try {
  const session = await client.createSession({
    workingDirectory: root,
    availableTools: ["skill"],
    skillDirectories: [join(root, "skills")],
    enableSkills: true,
    enableConfigDiscovery: false,
    enableFileHooks: false,
    enableSessionStore: false,
    onPermissionRequest: () => ({ kind: "reject" }),
  });
  const catalog = await session.rpc.skills.list();
  const commands = await session.rpc.commands.list();
  const entries = await readdir(join(root, "skills"), { withFileTypes: true });
  for (const entry of entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const text = await readFile(join(root, "skills", entry.name, "SKILL.md"), "utf8");
    const name = text.match(/^name:\s*(.+)$/m)?.[1].trim();
    assert(name, `${entry.name}: missing skill name`);
    const body = normalize(text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ""));
    assert(catalog.skills.some((skill) => skill.name === name), `${name}: missing from discovery`);
    assert(commands.commands.some((command) => command.name === name), `${name}: missing slash command`);
    const slash = await session.rpc.commands.invoke({ name, input: "" });
    assert.equal(slash.kind, "agent-prompt", `${name}: slash expansion failed`);
    assert(normalize(slash.prompt).includes(body), `${name}: slash expansion changed the workflow`);
    const tool = await session.rpc.tools.execute({ name: "skill", arguments: { skill: name } });
    const resultType = typeof tool === "string" ? "success" : tool.resultType;
    if (resultType !== "success") {
      const error = tool.error ?? tool.textResultForLlm;
      failures.push({ name, error });
      console.error(`${name}: ${error}`);
    } else {
      assert.equal(tool.skillInvocation?.name, name, `${name}: loader returned a different skill`);
      const loadedBody = normalize(tool.skillInvocation.content);
      assert(loadedBody.startsWith(body.split("\n", 1)[0]), `${name}: loader returned the wrong workflow`);
    }
    checked++;
  }
  assert(checked > 0, "No bundled skills were checked");
  await session.disconnect();
} finally {
  await client.stop();
  await rm(baseDirectory, { recursive: true, force: true });
}

console.log(`Skills checked: ${checked}; slash expansions: ${checked}; loader failures: ${failures.length}`);
assert.equal(failures.length, 0, "Every skill must load after slash expansion without Skill not found.");
