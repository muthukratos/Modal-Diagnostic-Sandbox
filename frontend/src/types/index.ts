export interface Recommendations {
  target_column: string;
  task_type: string;
  target_justification: string;
  task_justification: string;
}

export interface ScanResult {
  filename: string;
  columns: string[];
  count: number;
  recommendations: Recommendations;
  preview: Record<string, any>[];
}

export interface DatasetProfile {
  total_samples: number;
  total_features: number;
  numerical_features: number;
  categorical_features: number;
  missing_value_percentage: Record<string, number>;
  target_class_count?: Record<string, number>;
  target_range?: { min: number; max: number };
}

export interface SelectedModel {
  model: string;
  type: string;
  justification: string;
}

export interface ModelFilteringResult {
  selected_models: SelectedModel[];
  count: number;
}

export interface ModelMetrics {
  accuracy?: number;
  f1_score?: number;
  rmse?: number;
  r2_score?: number;
}

export interface EvaluatedModel {
  model: string;
  metrics: ModelMetrics;
  primary_value: number;
  justification?: string;
}

export interface BestModel {
  model: string;
  metrics: ModelMetrics;
  justification: string;
}

export interface TrainingEvaluationResult {
  models_evaluated: EvaluatedModel[];
  best_model: BestModel;
  train_samples: number;
  test_samples: number;
  training_strategy: {
    mode: string;
    reason: string;
    stage_1_models?: number;
    stage_2_models?: number;
  };
}

export interface GlobalExplanation {
  method: string;
  feature_importance: Record<string, number>;
  model_type: string;
}

export interface LimeContribution {
  feature: string;
  contribution: number;
}

export interface LocalExplanation {
  method: string;
  prediction: number;
  prediction_probability?: number[];
  explanation: LimeContribution[];
}

export interface ExplanationResult {
  model: string;
  task_type: string;
  global_explanation: GlobalExplanation;
  local_explanation?: LocalExplanation;
  error?: string;
  note?: string;
}

export interface AnalysisResult {
  pipeline_status: string;
  filename: string;
  task_type: {
    detected: string;
    was_auto_detected: boolean;
    justification: string;
  };
  target_column: {
    selected: string;
    was_auto_detected: boolean;
    justification: string;
  };
  profiling: DatasetProfile;
  model_filtering: ModelFilteringResult;
  training_evaluation: TrainingEvaluationResult;
  explanations: ExplanationResult;
}
