package dev.jobtrackr.domain;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum ApplicationPriority implements LabelledEnum {
    HAUTE("Haute"),
    MOYENNE("Moyenne"),
    BASSE("Basse");

    private final String label;

    ApplicationPriority(String label) {
        this.label = label;
    }

    @Override
    public String label() {
        return label;
    }

    @JsonCreator
    public static ApplicationPriority fromValue(String value) {
        return EnumSupport.fromLabel(ApplicationPriority.class, value);
    }
}
