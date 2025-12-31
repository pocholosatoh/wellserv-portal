import { useMemo, useState } from "react";
import { Modal, Platform, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { colors, radii, spacing } from "@wellserv/theme";

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type MeasuredAtRowProps = {
  value: Date | null;
  onChange: (next: Date | null) => void;
  disabled?: boolean;
};

export function MeasuredAtRow({ value, onChange, disabled }: MeasuredAtRowProps) {
  const [iosVisible, setIosVisible] = useState(false);
  const [iosTemp, setIosTemp] = useState<Date>(value ?? new Date());

  const displayText = useMemo(() => {
    if (!value) return "now";
    return dateTimeFormatter.format(value);
  }, [value]);

  const placeholder = !value;

  const openAndroidPicker = (base: Date) => {
    DateTimePickerAndroid.open({
      value: base,
      mode: "date",
      onChange: (event, date) => {
        if (event.type !== "set" || !date) return;
        const pickedDate = date;
        DateTimePickerAndroid.open({
          value: pickedDate,
          mode: "time",
          onChange: (timeEvent, timeDate) => {
            if (timeEvent.type !== "set" || !timeDate) return;
            const merged = new Date(pickedDate);
            merged.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0);
            onChange(merged);
          },
        });
      },
    });
  };

  const openPicker = () => {
    if (disabled) return;
    const base = value ?? new Date();
    if (Platform.OS === "android") {
      openAndroidPicker(base);
    } else {
      setIosTemp(base);
      setIosVisible(true);
    }
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View>
        <Text style={{ fontWeight: "700", color: colors.gray[800], marginBottom: 4 }}>Time</Text>
        <Text style={{ color: placeholder ? colors.gray[400] : colors.gray[700] }}>
          {displayText}
        </Text>
      </View>
      <TouchableOpacity
        onPress={openPicker}
        activeOpacity={0.85}
        disabled={disabled}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.gray[300],
          backgroundColor: "#fff",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Text style={{ fontWeight: "600", color: colors.gray[700] }}>Change time</Text>
      </TouchableOpacity>

      {Platform.OS === "ios" ? (
        <Modal
          transparent
          animationType="fade"
          visible={iosVisible}
          onRequestClose={() => setIosVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.35)",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                backgroundColor: "#fff",
                paddingTop: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.xl,
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
              }}
            >
              <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: spacing.sm }}>
                Select time
              </Text>
              <DateTimePicker
                value={iosTemp}
                mode="datetime"
                display="spinner"
                onChange={(_, date) => {
                  if (date) setIosTemp(date);
                }}
              />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
                <TouchableOpacity
                  onPress={() => setIosVisible(false)}
                  style={{ paddingVertical: 10, paddingHorizontal: 14 }}
                >
                  <Text style={{ color: colors.gray[600], fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    onChange(iosTemp);
                    setIosVisible(false);
                  }}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    backgroundColor: colors.primary,
                    borderRadius: radii.md,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Set time</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
