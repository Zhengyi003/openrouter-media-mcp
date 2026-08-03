# Homebrew Formula for openrouter-image-mcp
#
# Copy this file into a Homebrew tap repository as:
#   Formula/openrouter-image-mcp.rb
#
# The formula downloads the compiled release asset published on GitHub
# Releases, installs its runtime dependencies into a prefix-local
# node_modules, and exposes the `openrouter-image-mcp` command. GitHub
# Release is the single source of truth for installation artifacts; the same
# asset backs the manual-download instructions.
#
# Required fields to fill before each release:
#   - url: the GitHub Release asset for this version, e.g.
#       https://github.com/Zhengyi003/openrouter-media-mcp/releases/download/v0.1.1/openrouter-image-mcp-0.1.1.tgz
#   - sha256: from the matching `<version>.sha256` asset or release notes

class OpenrouterImageMcp < Formula
  desc "OpenRouter image generation MCP server for VS Code"
  homepage "https://github.com/Zhengyi003/openrouter-media-mcp"
  url "https://github.com/Zhengyi003/openrouter-media-mcp/releases/download/v0.1.1/openrouter-image-mcp-0.1.1.tgz"
  sha256 "8088c4263afd8809799ae4fe64342858a88227ff2ac936e0fae04610d9d9f28e"
  license "Apache-2.0"

  depends_on "node"

  def install
    # The release asset ships compiled dist/ plus package.json; install the
    # runtime dependencies into a prefix-local node_modules so the formula
    # does not depend on the user's global npm state.
    libexec.install Dir["*"]
    system "npm", "install", *std_npm_args(prefix: false), "--omit=dev", "--prefix", libexec

    (bin/"openrouter-image-mcp").write <<~EOS
      #!/bin/bash
      exec "#{formula_opt_bin("node")}/node" "#{libexec}/dist/index.js" "$@"
    EOS
    chmod 0755, bin/"openrouter-image-mcp"
  end

  def post_install
    ohai "OpenRouter image MCP installed."
    ohai "Register it in VS Code by running:  openrouter-image-mcp setup"
  end

  test do
    assert_match "setup", shell_output("#{bin}/openrouter-image-mcp 2>&1", 1)
  end
end
