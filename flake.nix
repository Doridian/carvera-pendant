{
  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    let
      packageJson = nixpkgs.lib.trivial.importJSON ./package.json;
    in
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        package = pkgs.buildNpmPackage {
          pname = packageJson.name;
          version = packageJson.version;
          src = ./.;
          npmDeps = pkgs.importNpmLock { npmRoot = ./.; };
          npmConfigHook = pkgs.importNpmLock.npmConfigHook;

          autoPatchelfIgnoreMissingDeps = [
            "libc.musl-x86_64.so.1"
          ];

          buildInputs = with pkgs; [
            (nixpkgs.lib.getLib udev)
            libusb1
            (nixpkgs.lib.getLib pkgs.stdenv.cc.cc)
          ];

          nativeBuildInputs = [
            pkgs.autoPatchelfHook
          ];
        };
      in
      {
        packages.default = package;
        packages.${packageJson.name} = package;
      }
    );
}
