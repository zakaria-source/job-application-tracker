package dev.jobtrackr.application.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import dev.jobtrackr.common.domain.EnumSupport;
import dev.jobtrackr.common.domain.LabelledEnum;

public enum SalaryPeriod implements LabelledEnum {
    ANNUEL("Annuel"),
    JOURNALIER("Journalier");

    private final String label;

    SalaryPeriod(String label) {
        this.label = label;
    }

    @Override
    public String label() {
        return label;
    }

    @JsonCreator
    public static SalaryPeriod fromValue(String value) {
        return EnumSupport.fromLabel(SalaryPeriod.class, value);
    }
}
