package dev.jobtrackr.application.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import dev.jobtrackr.common.domain.EnumSupport;
import dev.jobtrackr.common.domain.LabelledEnum;

public enum RecruitmentStage implements LabelledEnum {
    CANDIDATURE("Candidature"),
    SCREENING_RH("Screening RH"),
    ENTRETIEN_TECHNIQUE("Entretien technique"),
    HIRING_MANAGER("Hiring Manager"),
    ENTRETIEN_FINAL("Entretien final"),
    OFFRE("Offre"),
    CLOTURE("Clôturé");

    private final String label;

    RecruitmentStage(String label) {
        this.label = label;
    }

    @Override
    public String label() {
        return label;
    }

    @JsonCreator
    public static RecruitmentStage fromValue(String value) {
        return EnumSupport.fromLabel(RecruitmentStage.class, value);
    }

    public ApplicationStatus impliedStatus() {
        return switch (this) {
            case CANDIDATURE -> ApplicationStatus.ENVOYE;
            case SCREENING_RH, ENTRETIEN_TECHNIQUE, HIRING_MANAGER, ENTRETIEN_FINAL -> ApplicationStatus.ENTRETIEN;
            case OFFRE -> ApplicationStatus.ACCEPTE;
            case CLOTURE -> ApplicationStatus.REFUSE;
        };
    }
}
