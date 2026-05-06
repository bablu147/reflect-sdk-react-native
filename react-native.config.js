module.exports = {
  dependency: {
    platforms: {
      ios: {},
      android: {
        packageImportPath: "import com.reflect.rn.ReflectPackage;",
        packageInstance: "new ReflectPackage()",
      },
    },
  },
};
