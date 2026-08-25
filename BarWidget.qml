import QtQuick
import qs.Commons
import qs.Ui

BarWidget {
  id: root
  moduleName: "io.github.howdyitskyle.weathering"

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
  }

  function refresh() {
    if (panelLoader.item && panelLoader.item.refresh) panelLoader.item.refresh()
  }

  function togglePanel() {
    if (panelLoader.item && panelLoader.item.toggle) panelLoader.item.toggle()
  }

  function openRadar() {
    if (panelLoader.item && panelLoader.item.openRadar) panelLoader.item.openRadar()
  }

  // Shape contract for shell.summon/hide/toggle routing (Bar.findPanelWidget
  // requires open/close/opened on the bar-widget root). Open maps to the
  // panel's hotkey path so summoning suppresses the center hover reveal,
  // matching what the old per-plugin IpcHandler did.
  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false

  function open() {
    if (panelLoader.item && panelLoader.item.openFromHotkey) panelLoader.item.openFromHotkey()
  }

  function close() {
    if (panelLoader.item && panelLoader.item.close) panelLoader.item.close()
  }

  // Forwarded so this widget can stand in for the panel as the bar's popout
  // identity: Bar.requestPopout prefers closeForPopoutSwitch over close, and
  // KeyboardPanel reads popoutSwitchClosing back off its owner.
  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  // Read off the panel so the pill and the hero never disagree.
  readonly property string glyph: panelLoader.item ? panelLoader.item.label : ""
  readonly property string temp: panelLoader.item ? panelLoader.item.barTemp : ""
  readonly property color glyphColor: panelLoader.item ? panelLoader.item.glyphColor
    : (root.bar ? root.bar.foreground : Color.foreground)
  // An active severe alert outranks the condition color: the pill goes to the
  // theme's urgent color through the shell's own active state, so a warning
  // looks the same here as everywhere else in the bar.
  readonly property bool alertUrgent: panelLoader.item ? panelLoader.item.alertUrgent === true : false

  visible: root.glyph !== ""
  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  // WidgetButton rather than BarIconButton: the pill carries a glyph and a
  // temperature at two different sizes, which the icon button's single square
  // optical canvas cannot hold. This is how BarIconButton composes itself, so
  // click routing, hover reveal, and bar registration are unchanged.
  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    labelVisible: false
    hasVisualContent: root.glyph !== ""
    active: root.alertUrgent
    // Tooltip suppressed because the panel is the detail view.
    tooltipText: ""

    // Content-driven, with the standard icon slot as a floor so a missing
    // temperature does not shrink the widget below its neighbors.
    fixedWidth: vertical ? -1 : Math.max(Style.bar.iconSlot, content.implicitWidth + scaledHorizontalMargin * 2)
    fixedHeight: vertical ? Math.max(Style.bar.iconSlot, content.implicitHeight + scaledVerticalPadding * 2) : -1

    Grid {
      id: content
      anchors.centerIn: parent
      // Side by side on a horizontal bar; stacked on a vertical one, where
      // there is height to spare and no width.
      rows: button.vertical ? 2 : 1
      columns: button.vertical ? 1 : 2
      rowSpacing: 0
      columnSpacing: Style.space(5)
      horizontalItemAlignment: Grid.AlignHCenter
      verticalItemAlignment: Grid.AlignVCenter

      Text {
        text: root.glyph
        color: root.alertUrgent ? button.activeColor : root.glyphColor
        font.family: button.fontFamily
        font.pixelSize: Style.font.iconLarge
      }

      Text {
        visible: root.temp !== ""
        text: root.temp
        color: button.foreground
        font.family: button.fontFamily
        font.pixelSize: Style.font.body
      }
    }

    onPressed: function(b) {
      if (!root.bar) return
      // Right-click opens the radar loop; the status notification it replaced
      // only restated what the panel already shows.
      if (b === Qt.RightButton) root.openRadar()
      else if (b === Qt.MiddleButton) root.refresh()
      else root.togglePanel()
    }
  }
}
