package dev.jobtrackr.common.domain;

import java.util.Arrays;

public final class EnumSupport {

    private EnumSupport() {
    }

    public static <E extends Enum<E> & LabelledEnum> E fromLabel(Class<E> type, String value) {
        if (value == null) {
            return null;
        }
        return Arrays.stream(type.getEnumConstants())
            .filter(candidate -> candidate.label().equalsIgnoreCase(value) || candidate.name().equalsIgnoreCase(value))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Unsupported " + type.getSimpleName() + ": " + value));
    }
}
