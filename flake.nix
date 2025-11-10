{
  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }: let
    packageJson = nixpkgs.lib.trivial.importJSON ./package.json;
  in
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        package = pkgs.buildNpmPackage {
          pname = packageJson.name;
          version = packageJson.version;
          src = ./.;
          npmDeps = pkgs.importNpmLock { npmRoot = ./.; };
          npmConfigHook = pkgs.importNpmLock.npmConfigHook;
        };
      in
      {
        packages.default = package;
        packages.${packageJson.name} = package;
      });
}
