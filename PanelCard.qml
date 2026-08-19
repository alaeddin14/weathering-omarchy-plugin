import QtQuick
import qs.Commons

// Rounded card container used across the panel. The subtle fill separates
// sections. Content goes in as children (default property); the card sizes
// itself to the content plus padding.
Rectangle {
  id: card

  required property color foreground
  property int pad: Style.space(10)
  default property alias content: contentItem.children

  radius: Style.cornerRadius
  color: Qt.rgba(foreground.r, foreground.g, foreground.b, 0.06)

  implicitWidth: contentItem.implicitWidth + pad * 2
  implicitHeight: contentItem.implicitHeight + pad * 2

  Item {
    id: contentItem
    x: card.pad
    y: card.pad
    width: card.width - card.pad * 2
    height: card.height - card.pad * 2
  }
}