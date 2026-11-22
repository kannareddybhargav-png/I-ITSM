package com.itsm.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Small key/value table for settings an administrator changes at runtime (e.g. the active assignment strategy). */
@Entity
@Table(name = "app_setting")
@Getter @Setter @NoArgsConstructor
public class AppSetting {
    @Id
    @Column(name = "setting_key", length = 100)
    private String key;
    @Column(name = "setting_value", length = 500)
    private String value;

    public AppSetting(String key, String value) { this.key = key; this.value = value; }
}
