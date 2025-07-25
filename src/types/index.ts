
export interface SubStep {
    step: string;
    numbering: string;
    time_stamp: string;
    thumbnail?: string; // Add optional thumbnail path
  }
  
  export interface Step {
    group_name: string;
    numbering: string;
    time_stamp: string;
    thumbnail?: string; // Add optional thumbnail path
    sub_steps: SubStep[];
  }
  
  export interface Application {
    application_name: string;
    type: string;
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
  