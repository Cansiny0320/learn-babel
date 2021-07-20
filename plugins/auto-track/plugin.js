const { declare } = require("@babel/helper-plugin-utils")
const importModule = require("@babel/helper-module-imports")

const autoTrackPlugin = declare((api, options, dirname) => {
  api.assertVersion(7)

  return {
    visitor: {
      Program: {
        enter(path, state) {
          path.traverse({
            ImportDeclaration(curPath) {
              const requirePath = curPath.get("source").node.value
              if (requirePath === options.trackerPath) {
                // 如果已经引入了
                const specifierPath = curPath.get("specifiers.0")
                if (specifierPath.isImportSpecifier()) {
                  state.trackerImportId = specifierPath.toString()
                } else if (specifierPath.isImportNamespaceSpecifier()) {
                  state.trackerImportId = specifierPath.get("local").toString() // tracker 模块的 id
                }
                path.stop() // 找到了就终止遍历
              }
            },
          })
          if (!state.trackerImportId) {
            state.trackerImportId = importModule.addDefault(path, "tracker", {
              nameHint: path.scope.generateUid("tracker"),
            }).name // tracker 模块的 id
            state.trackerAST = api.template.statement(`${state.trackerImportId}()`)()
          }
        },
      },
      "ClassMethod|ArrowFunctionExpression|FunctionExpression|FunctionDeclaration"(path, state) {
        const bodyPath = path.get("body")
        if (bodyPath.isBlockStatement()) {
          // 有函数体就在开始插入埋点代码
          bodyPath.node.body.unshift(state.trackerAST)
        } else {
          const ast = api.template.statement(`{${state.trackerImportId}();return PREV_BODY;}`)({
            PREV_BODY: bodyPath.node,
          })
          bodyPath.replaceWith(ast)
        }
      },
    },
  }
})

module.exports = autoTrackPlugin
