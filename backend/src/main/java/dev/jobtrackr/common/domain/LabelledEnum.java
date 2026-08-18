package dev.jobtrackr.common.domain;

import com.fasterxml.jackson.annotation.JsonValue;

public interface LabelledEnum {

    @JsonValue
    String label();
}
