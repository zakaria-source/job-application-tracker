package dev.jobtrackr.mailtracking;

public enum EmailSignalType {
    ACKNOWLEDGEMENT("Accusé de réception"),
    INTERVIEW("Invitation entretien"),
    OFFER("Offre"),
    REJECTION("Refus"),
    FOLLOW_UP("Relance / reprise de contact"),
    OTHER("Autre message");

    private final String label;

    EmailSignalType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
