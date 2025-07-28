// src/types/index.ts

export interface SubStep {
    step: string;
    numbering: string;
    time_stamp: string;
    thumbnail?: string;
  }
  
  export interface Step {
    group_name: string;
    numbering: string;
    time_stamp: string;
    thumbnail?: string;
    sub_steps: SubStep[];
  }
  
  // --- Add the 'description' property here ---
  export interface Application {
    application_name: string;
    type: string;
    description: string; // New field for the "Purpose" column
    url: string;
  }
  
  export interface Exception {
    exception: string;
    description: string;
  }
  
  export interface ProcessDocument {
    process_name: string;
    short_process_description: string;
    list_of_applications: Application[];
    list_of_steps: Step[];
    exceptions: Exception[];
    clarifications: string[];
  }
  