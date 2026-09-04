// Hand-rolled SVG icon set (no external icon library) -- one base <svg> wrapper (Icon) plus one
// small component per icon, all pure/stateless. Imported by other src/components/ files that
// render one of these; safe to import and render in tests with no other setup.

import React from "react";

export function Icon({
  children,
  size = 18,
  style
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0,
      ...style
    }
  }, children);
}

export const AlertTriangle = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
}), /*#__PURE__*/React.createElement("line", {
  x1: "12",
  y1: "9",
  x2: "12",
  y2: "13"
}), /*#__PURE__*/React.createElement("line", {
  x1: "12",
  y1: "17",
  x2: "12.01",
  y2: "17"
}));

export const ArrowLeftRight = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("polyline", {
  points: "16 3 21 8 16 13"
}), /*#__PURE__*/React.createElement("line", {
  x1: "21",
  y1: "8",
  x2: "3",
  y2: "8"
}), /*#__PURE__*/React.createElement("polyline", {
  points: "8 11 3 16 8 21"
}), /*#__PURE__*/React.createElement("line", {
  x1: "3",
  y1: "16",
  x2: "21",
  y2: "16"
}));

export const Bell = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
}), /*#__PURE__*/React.createElement("path", {
  d: "M10.3 21a1.94 1.94 0 0 0 3.4 0"
}));

export const BookOpen = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M12 7v14"
}), /*#__PURE__*/React.createElement("path", {
  d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
}));

export const CalendarClock = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("rect", {
  x: "3",
  y: "5",
  width: "18",
  height: "16",
  rx: "3"
}), /*#__PURE__*/React.createElement("line", {
  x1: "3",
  y1: "10",
  x2: "21",
  y2: "10"
}), /*#__PURE__*/React.createElement("line", {
  x1: "8",
  y1: "2",
  x2: "8",
  y2: "6"
}), /*#__PURE__*/React.createElement("line", {
  x1: "16",
  y1: "2",
  x2: "16",
  y2: "6"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 14v2.5l1.8 1"
}));

export const Check = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("polyline", {
  points: "20 6 9 17 4 12"
}));

export const ChevronDown = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("polyline", {
  points: "6 9 12 15 18 9"
}));

export const ChevronLeft = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("polyline", {
  points: "15 18 9 12 15 6"
}));

export const ChevronRight = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("polyline", {
  points: "9 18 15 12 9 6"
}));

export const Circle = ({
  size = 18,
  fill = "currentColor",
  style
}) => /*#__PURE__*/React.createElement("svg", {
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  style: style
}, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "9",
  fill: fill
}));

export const Download = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M12 3v12"
}), /*#__PURE__*/React.createElement("polyline", {
  points: "7 10 12 15 17 10"
}), /*#__PURE__*/React.createElement("path", {
  d: "M5 21h14"
}));

export const FileText = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
}), /*#__PURE__*/React.createElement("polyline", {
  points: "14 2 14 8 20 8"
}), /*#__PURE__*/React.createElement("line", {
  x1: "16",
  y1: "13",
  x2: "8",
  y2: "13"
}), /*#__PURE__*/React.createElement("line", {
  x1: "16",
  y1: "17",
  x2: "8",
  y2: "17"
}), /*#__PURE__*/React.createElement("line", {
  x1: "10",
  y1: "9",
  x2: "8",
  y2: "9"
}));

export const Globe = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "9"
}), /*#__PURE__*/React.createElement("line", {
  x1: "3",
  y1: "12",
  x2: "21",
  y2: "12"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"
}));

export const GoogleGLogo = ({
  size = 18,
  style
}) => /*#__PURE__*/React.createElement("svg", {
  width: size,
  height: size,
  viewBox: "0 0 18 18",
  style: {
    flexShrink: 0,
    ...style
  }
}, /*#__PURE__*/React.createElement("path", {
  fill: "#4285F4",
  d: "M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
}), /*#__PURE__*/React.createElement("path", {
  fill: "#34A853",
  d: "M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
}), /*#__PURE__*/React.createElement("path", {
  fill: "#FBBC05",
  d: "M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2822-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z"
}), /*#__PURE__*/React.createElement("path", {
  fill: "#EA4335",
  d: "M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
}));

export const Hand = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"
}), /*#__PURE__*/React.createElement("path", {
  d: "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"
}));

export const Hash = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("line", {
  x1: "4",
  y1: "9",
  x2: "20",
  y2: "9"
}), /*#__PURE__*/React.createElement("line", {
  x1: "4",
  y1: "15",
  x2: "20",
  y2: "15"
}), /*#__PURE__*/React.createElement("line", {
  x1: "10",
  y1: "3",
  x2: "8",
  y2: "21"
}), /*#__PURE__*/React.createElement("line", {
  x1: "16",
  y1: "3",
  x2: "14",
  y2: "21"
}));

export const Heart = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
}));

export const HelpCircle = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "10"
}), /*#__PURE__*/React.createElement("path", {
  d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
}), /*#__PURE__*/React.createElement("line", {
  x1: "12",
  y1: "17",
  x2: "12.01",
  y2: "17"
}));

export const House = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"
}), /*#__PURE__*/React.createElement("path", {
  d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
}));

export const InboxIcon = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("polyline", {
  points: "22 12 16 12 14 15 10 15 8 12 2 12"
}), /*#__PURE__*/React.createElement("path", {
  d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
}));

export const Info = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "10"
}), /*#__PURE__*/React.createElement("line", {
  x1: "12",
  y1: "16",
  x2: "12",
  y2: "12"
}), /*#__PURE__*/React.createElement("line", {
  x1: "12",
  y1: "8",
  x2: "12.01",
  y2: "8"
}));

export const LogIn = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"
}), /*#__PURE__*/React.createElement("polyline", {
  points: "10 17 15 12 10 7"
}), /*#__PURE__*/React.createElement("line", {
  x1: "15",
  y1: "12",
  x2: "3",
  y2: "12"
}));

export const LogOut = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
}), /*#__PURE__*/React.createElement("polyline", {
  points: "16 17 21 12 16 7"
}), /*#__PURE__*/React.createElement("line", {
  x1: "21",
  y1: "12",
  x2: "9",
  y2: "12"
}));

export const MessageCircle = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
}));

export const Monitor = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("rect", {
  x: "2",
  y: "4",
  width: "20",
  height: "14",
  rx: "2"
}), /*#__PURE__*/React.createElement("line", {
  x1: "8",
  y1: "21",
  x2: "16",
  y2: "21"
}), /*#__PURE__*/React.createElement("line", {
  x1: "12",
  y1: "18",
  x2: "12",
  y2: "21"
}));

export const Moon = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z"
}));

export const MoreVertical = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "1"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "5",
  r: "1"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "19",
  r: "1"
}));

export const Pencil = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"
}));

export const Pin = ({
  size = 18,
  fill,
  style
}) => /*#__PURE__*/React.createElement("svg", {
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: fill || "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  style: {
    flexShrink: 0,
    ...style
  }
}, /*#__PURE__*/React.createElement("path", {
  d: "M12 17v5"
}), /*#__PURE__*/React.createElement("path", {
  d: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"
}));

export const Plus = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("line", {
  x1: "12",
  y1: "5",
  x2: "12",
  y2: "19"
}), /*#__PURE__*/React.createElement("line", {
  x1: "5",
  y1: "12",
  x2: "19",
  y2: "12"
}));

export const Printer = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("polyline", {
  points: "6 9 6 2 18 2 18 9"
}), /*#__PURE__*/React.createElement("path", {
  d: "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
}), /*#__PURE__*/React.createElement("rect", {
  x: "6",
  y: "14",
  width: "12",
  height: "8"
}));

export const Radio = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M4.9 19.1C1 15.2 1 8.8 4.9 4.9"
}), /*#__PURE__*/React.createElement("path", {
  d: "M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"
}), /*#__PURE__*/React.createElement("path", {
  d: "M19.1 4.9C23 8.8 23 15.1 19.1 19"
}));

export const Share = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
  cx: "18",
  cy: "5",
  r: "3"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "6",
  cy: "12",
  r: "3"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "18",
  cy: "19",
  r: "3"
}), /*#__PURE__*/React.createElement("line", {
  x1: "8.6",
  y1: "10.6",
  x2: "15.4",
  y2: "6.4"
}), /*#__PURE__*/React.createElement("line", {
  x1: "8.6",
  y1: "13.4",
  x2: "15.4",
  y2: "17.6"
}));

export const Shield = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
}));

export const Sun = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "4"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
}));

export const Table2 = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("rect", {
  x: "3",
  y: "3",
  width: "18",
  height: "18",
  rx: "2"
}), /*#__PURE__*/React.createElement("line", {
  x1: "3",
  y1: "9",
  x2: "21",
  y2: "9"
}), /*#__PURE__*/React.createElement("line", {
  x1: "3",
  y1: "15",
  x2: "21",
  y2: "15"
}), /*#__PURE__*/React.createElement("line", {
  x1: "12",
  y1: "3",
  x2: "12",
  y2: "21"
}));

export const Trash2 = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M3 6h18"
}), /*#__PURE__*/React.createElement("path", {
  d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
}), /*#__PURE__*/React.createElement("line", {
  x1: "10",
  y1: "11",
  x2: "10",
  y2: "17"
}), /*#__PURE__*/React.createElement("line", {
  x1: "14",
  y1: "11",
  x2: "14",
  y2: "17"
}));

export const Trophy = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M8 21h8"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 17v4"
}), /*#__PURE__*/React.createElement("path", {
  d: "M7 4h10v5a5 5 0 0 1-10 0V4z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M7 5H4.5a2 2 0 0 0 0 4H6"
}), /*#__PURE__*/React.createElement("path", {
  d: "M17 5h2.5a2 2 0 0 1 0 4H18"
}));

export const Undo2 = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M9 14 4 9l5-5"
}), /*#__PURE__*/React.createElement("path", {
  d: "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
}));

export const User = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "7",
  r: "4"
}));

export const Users = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "9",
  cy: "7",
  r: "4"
}), /*#__PURE__*/React.createElement("path", {
  d: "M23 21v-2a4 4 0 0 0-3-3.87"
}), /*#__PURE__*/React.createElement("path", {
  d: "M16 3.13a4 4 0 0 1 0 7.75"
}));

export const WhatsAppIcon = ({
  size = 18,
  style
}) => /*#__PURE__*/React.createElement("svg", {
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  style: {
    flexShrink: 0,
    ...style
  }
}, /*#__PURE__*/React.createElement("path", {
  d: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M20.52 3.449C18.24 1.245 15.24 0 12.05 0 5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893.001-3.177-1.235-6.166-3.423-8.452zM12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.999-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.263c.002-5.45 4.437-9.884 9.889-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.451-4.438 9.888-9.887 9.888z"
}));

export function Cap({
  size = 18,
  style
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    style: {
      flexShrink: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 14A8 8 0 0 1 20 14C21.5 14.3 23 15.3 23 16.8C22.5 18 17 17.8 13 16.3Q8 17 4 15.3Z"
  }));
}
