try {
  const semver = require("semver");
  const versions = ["2026.2.14", "2026.2.14.1", "2026.2.14-1"];
  versions.forEach((v) => {
    console.log(`Version ${v} is valid: ${semver.valid(v)}`);
  });
} catch (e) {
  console.log("semver module not found, checking with npm itself?");
  // If semver not found, we can try to use a simple regex or assume strictness
  // But let's check if we can import it.
}
