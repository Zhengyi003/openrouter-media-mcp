# Homebrew Formula template for openrouter-image-mcp
#
# Copy this file into a Homebrew tap repository as:
#   Formula/openrouter-image-mcp.rb
#
# The formula downloads the same npm tarball that `npm install -g` uses, so the
# Homebrew and npm installation paths converge on the same CLI command. When a
# GitHub Release pipeline exists later, the `url`/`sha256` below can switch to
# release assets without changing the rest of the formula.
#
# Required fields to fill before use:
#   - url: set to the published npm tarball, e.g.
#       https://registry.npmjs.org/@lizhengyi/openrouter-image-mcp/-/openrouter-image-mcp-0.1.0.tgz
#   - sha256: run `shasum -a 256 <downloaded.tgz>` and paste the value

class OpenrouterImageMcp < Formula
  desc "OpenRouter image generation MCP server for VS Code"
  homepage "https://github.com/Zhengyi003/openrouter-media-mcp"
  url "https://registry.npmjs.org/@lizhengyi/openrouter-image-mcp/-/openrouter-image-mcp-0.1.0.tgz"
  sha256 "<paste-shasum-256-here>"
  license "Apache-2.0"

  depends_on "node"

  def install
    # The npm tarball ships compiled dist/ plus package.json; install the
    # runtime dependencies into a prefix-local node_modules so the formula
    # does not depend on the user's global npm state.
    system "npm", "install", "--omit=dev", "--no-audit", "--no-fund", "--prefix", libexec

    (bin/"openrouter-image-mcp").write <<~EOS
      #!/bin/bash
      exec "#{Formula["node"].opt_bin}/node" "#{libexec}/dist/index.js" "$@"
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
