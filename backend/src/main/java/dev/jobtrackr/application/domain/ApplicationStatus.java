package dev.jobtrackr.application.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import dev.jobtrackr.common.domain.EnumSupport;
import dev.jobtrackr.common.domain.LabelledEnum;

public enum ApplicationStatus implements LabelledEnum {
    ENVOYE("Envoyé"),
    ENTRETIEN("Entretien"),
    ACCEPTE("Accepté"),
    REFUSE("Refusé");

    private final String label;

    ApplicationStatus(String label) {
        this.label = label;
    }

    @Override
    public String label() {
        return label;
    }

    @JsonCreator
    public static ApplicationStatus fromValue(String value) {
        return EnumSupport.fromLabel(ApplicationStatus.class, value);
    }
}
