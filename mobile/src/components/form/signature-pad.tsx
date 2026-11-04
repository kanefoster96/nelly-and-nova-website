import { Image } from "expo-image";
import { useRef, useState } from "react";
import { PanResponder, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { Pressable } from "@/components/pressable";
import { colors } from "@/theme";

/*
 * Signature pad, as the Kanvas app's (components/signature-pad.tsx): a
 * finger draws an SVG path through React Native's PanResponder, with a
 * Clear button. Saved the way the website's pad saves it: a PNG, dark ink
 * on white, so trainers see an app signature exactly as they see one from
 * the website. Kanvas captures the view with react-native-view-shot, which
 * this build doesn't have, so the PNG comes from react-native-svg's own
 * toDataURL. The pad is drawn as paper (white, dark ink), so what's signed
 * is what's saved.
 *
 * `value` is the saved PNG data URL. Once signed (or coming back to a saved
 * draft), the pad shows that image with "Sign again".
 */

const INK = "#111111";
const PAD_HEIGHT = 170;

type SvgHandle = { toDataURL: (cb: (base64: string) => void, options?: object) => void };

export function SignaturePad({
  value,
  onChange,
  onDrawingChange,
  invalid = false,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  /** A finger is on the pad: the screen should stop scrolling meanwhile. */
  onDrawingChange?: (drawing: boolean) => void;
  invalid?: boolean;
}) {
  const [editing, setEditing] = useState(!value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!value) setEditing(true);
  }

  if (!editing && value) {
    return (
      <View>
        <View style={{ borderRadius: 12, backgroundColor: "#ffffff", padding: 10, height: PAD_HEIGHT, alignItems: "center", justifyContent: "center" }}>
          <Image source={{ uri: value }} style={{ width: "100%", height: "100%" }} contentFit="contain" accessibilityLabel="Your signature" />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <Text style={{ color: colors.success, fontSize: 13 }}>Signature added</Text>
          <Pressable
            onPress={() => {
              onChange("");
              setEditing(true);
            }}
            hitSlop={10}
          >
            <Text style={{ color: colors.muted, fontSize: 13, textDecorationLine: "underline" }}>Sign again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  return <DrawingPad onChange={onChange} onDrawingChange={onDrawingChange} invalid={invalid} />;
}

function DrawingPad({ onChange, onDrawingChange, invalid }: { onChange: (dataUrl: string) => void; onDrawingChange?: (drawing: boolean) => void; invalid: boolean }) {
  const svgRef = useRef<SvgHandle | null>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [width, setWidth] = useState(0);
  const latest = useRef({ onChange, onDrawingChange });
  latest.current = { onChange, onDrawingChange };
  const currentRef = useRef("");

  /** After each stroke: the whole signature as a PNG. */
  const capture = () => {
    // Let the finished stroke render before it's captured.
    requestAnimationFrame(() => {
      svgRef.current?.toDataURL((base64) => {
        if (base64) latest.current.onChange(`data:image/png;base64,${base64}`);
      });
    });
  };

  const finish = () => {
    latest.current.onDrawingChange?.(false);
    const stroke = currentRef.current;
    currentRef.current = "";
    setCurrent("");
    if (stroke) {
      setPaths((p) => [...p, stroke]);
      capture();
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      // Never hand the stroke to the scrolling page mid-signature.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        latest.current.onDrawingChange?.(true);
        // A dot for a single tap (initials, full stops).
        currentRef.current = `M${x.toFixed(1)},${y.toFixed(1)} L${(x + 0.1).toFixed(1)},${(y + 0.1).toFixed(1)}`;
        setCurrent(currentRef.current);
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        currentRef.current = `${currentRef.current} L${x.toFixed(1)},${y.toFixed(1)}`;
        setCurrent(currentRef.current);
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    }),
  ).current;

  const empty = paths.length === 0 && !current;

  return (
    <View>
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: PAD_HEIGHT, borderRadius: 12, overflow: "hidden", backgroundColor: "#ffffff", borderWidth: invalid ? 2 : 0, borderColor: colors.danger }}
        accessibilityLabel="Signature pad. Draw your signature with your finger."
        {...responder.panHandlers}
      >
        {width > 0 && (
          <Svg ref={svgRef as never} width={width} height={PAD_HEIGHT}>
            <Rect x={0} y={0} width={width} height={PAD_HEIGHT} fill="#ffffff" />
            {paths.map((d, i) => (
              <Path key={i} d={d} stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {!!current && <Path d={current} stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          </Svg>
        )}
        {empty && (
          <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: 18, borderTopWidth: 1, borderTopColor: "#d4d4d4", paddingTop: 6 }}>
            <Text style={{ color: "#8a8a8a", fontSize: 12 }}>Sign here with your finger</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>{empty ? "Draw your signature above" : "Signature captured"}</Text>
        <Pressable
          onPress={() => {
            setPaths([]);
            setCurrent("");
            currentRef.current = "";
            onChange("");
          }}
          hitSlop={10}
          disabled={empty}
        >
          <Text style={{ color: empty ? "rgba(245,242,234,0.3)" : colors.muted, fontSize: 13, textDecorationLine: "underline" }}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}
