import QtQuick
import qs.Commons

// Label + value stat cell used in the hero stats grid.
Column {
  id: stat

  required property string label
  required property string value
  property color foreground: Color.foreground
  property string fontFamily: Style.font.family
  readonly property color dim: Util.alpha(foreground, 0.7)

  spacing: Style.space(5)

  Text {
    text: stat.label
    color: stat.dim
    font.family: stat.fontFamily
    font.pixelSize: Style.font.bodySmall
    font.letterSpacing: Math.max(1, Math.round(Style.font.bodySmall * 0.08))
  }

  Text {
    text: stat.value
    color: stat.foreground
    font.family: stat.fontFamily
    font.pixelSize: Style.font.title
  }
}
