自定义玩家状态页(可选)
=========================

把文件放到本目录(custom/):

  custom/index.html   -> 完全替换玩家状态页(默认是 /  页面)
                        页面中通过 fetch('/api/status') 获取全部服务器状态 JSON
  custom/style.css    -> 附加到默认样式的自定义样式(覆盖颜色/布局)
  custom/logo.png     -> 自定义图标(在 index.html 中引用 /logo.png 即可)

custom/ 里的文件在 webui 启动后即时生效,无需重启。

示例:复制默认页开始改:
  cp src/webui/public/index.html custom/index.html