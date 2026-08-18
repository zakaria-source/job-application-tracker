package dev.jobtrackr.domain;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum ContractType implements LabelledEnum {
    CDI("CDI"),
    CDD("CDD"),
    FREELANCE("Freelance"),
    STAGE("Stage"),
    ALTERNANCE("Alternance"),
    AUTRE("Autre");

    private final String label;

    ContractType(String label) {
        this.label = label;
    }

    @Override
    public String label() {
        return label;
    }

    @JsonCreator
    public static ContractType fromValue(String value) {
        return EnumSupport.fromLabel(ContractType.class, value);
    }
}
