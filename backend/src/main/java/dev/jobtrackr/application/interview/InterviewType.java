package dev.jobtrackr.application.interview;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum InterviewType implements LabelledEnum {
    TELEPHONE("Téléphone"),
    VISIOCONFERENCE("Visioconférence"),
    EN_PERSONNE("En personne");

    private final String label;

    InterviewType(String label) {
        this.label = label;
    }

    @Override
    public String label() {
        return label;
    }

    @JsonCreator
    public static InterviewType fromValue(String value) {
        return EnumSupport.fromLabel(InterviewType.class, value);
    }
}
