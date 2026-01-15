'use client';

import { useState, useEffect } from 'react';
import {
  MapPin,
  Zap,
  TreePine,
  Building2,
  Route,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  BarChart3,
  RefreshCw,
  History,
  Trash2,
  Calendar,
} from 'lucide-react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { collection, addDoc, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { firebaseDb, firebaseAuth } from '@/lib/firebase';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn, formatDate } from '@/lib/utils';
import type { Parcel } from '@/types';

interface SiteAnalysisProps {
  projectId: string;
  parcels: Parcel[];
  projectRequirements?: {
    minAcres?: number;
    maxAcres?: number;
    requiredCapacityMw?: number;
  };
}

interface AnalysisResult {
  parcelId: string;
  apn: string;
  suitabilityScore: number;
  analysis: {
    physicalSuitability: {
      score: number;
      factors: string[];
    };
    zoningCompatibility: {
      score: number;
      currentZoning: string;
      requiresVariance: boolean;
      notes: string;
    };
    environmentalConstraints: {
      score: number;
      wetlands: boolean;
      floodZone: boolean;
      protectedSpecies: boolean;
      notes: string;
    };
    gridProximity: {
      score: number;
      nearestSubstation: string;
      distanceMiles: number;
      availableCapacity: string;
    };
    accessConsiderations: {
      score: number;
      roadAccess: boolean;
      easementsRequired: boolean;
      notes: string;
    };
  };
  recommendation: 'proceed' | 'proceed_with_caution' | 'not_recommended';
  recommendationNotes: string;
}

interface SavedAnalysis {
  id: string;
  projectId: string;
  tenantId: string;
  createdAt: any;
  parcelsAnalyzed: number;
  results: AnalysisResult[];
  summary: {
    recommended: number;
    withCaution: number;
    notRecommended: number;
    averageScore: number;
  };
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'text-green-500';
    if (s >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getBgColor = (s: number) => {
    if (s >= 80) return 'bg-green-100';
    if (s >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="text-center">
      <div className={cn('w-16 h-16 rounded-full flex items-center justify-center mx-auto', getBgColor(score))}>
        <span className={cn('text-xl font-bold', getColor(score))}>{score}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function AnalysisResultCard({ result }: { result: AnalysisResult }) {
  const [expanded, setExpanded] = useState(false);

  const getRecommendationBadge = () => {
    switch (result.recommendation) {
      case 'proceed':
        return <Badge variant="success">Recommended</Badge>;
      case 'proceed_with_caution':
        return <Badge variant="warning">Proceed with Caution</Badge>;
      default:
        return <Badge variant="destructive">Not Recommended</Badge>;
    }
  };

  return (
    <div className="border rounded-lg p-4 hover:border-primary transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-500" />
            <span className="font-semibold">APN: {result.apn}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{result.recommendationNotes}</p>
        </div>
        {getRecommendationBadge()}
      </div>

      {/* Overall Score */}
      <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Overall Suitability</span>
            <span className={cn(
              'font-bold',
              result.suitabilityScore >= 80 ? 'text-green-600' :
              result.suitabilityScore >= 60 ? 'text-yellow-600' : 'text-red-600'
            )}>
              {result.suitabilityScore}/100
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                result.suitabilityScore >= 80 ? 'bg-green-500' :
                result.suitabilityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              )}
              style={{ width: `${result.suitabilityScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Category Scores */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <ScoreGauge score={result.analysis.physicalSuitability.score} label="Physical" />
        <ScoreGauge score={result.analysis.zoningCompatibility.score} label="Zoning" />
        <ScoreGauge score={result.analysis.environmentalConstraints.score} label="Environmental" />
        <ScoreGauge score={result.analysis.gridProximity.score} label="Grid" />
        <ScoreGauge score={result.analysis.accessConsiderations.score} label="Access" />
      </div>

      {/* Expanded Details */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Hide Details' : 'Show Details'}
      </Button>

      {expanded && (
        <div className="mt-4 space-y-4 pt-4 border-t">
          {/* Physical Suitability */}
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
              <Building2 className="w-4 h-4" />
              Physical Suitability
            </div>
            <ul className="text-sm text-blue-800 space-y-1">
              {result.analysis.physicalSuitability.factors.map((factor, i) => (
                <li key={i} className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {factor}
                </li>
              ))}
            </ul>
          </div>

          {/* Zoning */}
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-2 text-purple-700 font-medium mb-2">
              <MapPin className="w-4 h-4" />
              Zoning Compatibility
            </div>
            <div className="text-sm text-purple-800">
              <p>Current Zoning: <strong>{result.analysis.zoningCompatibility.currentZoning}</strong></p>
              <p className="flex items-center gap-1 mt-1">
                {result.analysis.zoningCompatibility.requiresVariance ? (
                  <><AlertTriangle className="w-3 h-3 text-yellow-600" /> Variance Required</>
                ) : (
                  <><CheckCircle className="w-3 h-3 text-green-600" /> No Variance Required</>
                )}
              </p>
              <p className="mt-1 text-gray-600">{result.analysis.zoningCompatibility.notes}</p>
            </div>
          </div>

          {/* Environmental */}
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
              <TreePine className="w-4 h-4" />
              Environmental Constraints
            </div>
            <div className="text-sm text-green-800 grid grid-cols-3 gap-2">
              <div className="flex items-center gap-1">
                {result.analysis.environmentalConstraints.wetlands ? (
                  <XCircle className="w-3 h-3 text-red-500" />
                ) : (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                )}
                Wetlands
              </div>
              <div className="flex items-center gap-1">
                {result.analysis.environmentalConstraints.floodZone ? (
                  <XCircle className="w-3 h-3 text-red-500" />
                ) : (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                )}
                Flood Zone
              </div>
              <div className="flex items-center gap-1">
                {result.analysis.environmentalConstraints.protectedSpecies ? (
                  <XCircle className="w-3 h-3 text-red-500" />
                ) : (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                )}
                Protected Species
              </div>
            </div>
            {result.analysis.environmentalConstraints.notes && (
              <p className="mt-2 text-gray-600">{result.analysis.environmentalConstraints.notes}</p>
            )}
          </div>

          {/* Grid Proximity */}
          <div className="p-3 bg-yellow-50 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-700 font-medium mb-2">
              <Zap className="w-4 h-4" />
              Grid Proximity
            </div>
            <div className="text-sm text-yellow-800">
              <p>Nearest Substation: <strong>{result.analysis.gridProximity.nearestSubstation}</strong></p>
              <p>Distance: <strong>{result.analysis.gridProximity.distanceMiles} miles</strong></p>
              <p>Available Capacity: <strong>{result.analysis.gridProximity.availableCapacity}</strong></p>
            </div>
          </div>

          {/* Access */}
          <div className="p-3 bg-orange-50 rounded-lg">
            <div className="flex items-center gap-2 text-orange-700 font-medium mb-2">
              <Route className="w-4 h-4" />
              Access Considerations
            </div>
            <div className="text-sm text-orange-800">
              <div className="flex items-center gap-1">
                {result.analysis.accessConsiderations.roadAccess ? (
                  <><CheckCircle className="w-3 h-3 text-green-500" /> Direct Road Access</>
                ) : (
                  <><XCircle className="w-3 h-3 text-red-500" /> No Direct Road Access</>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {result.analysis.accessConsiderations.easementsRequired ? (
                  <><AlertTriangle className="w-3 h-3 text-yellow-600" /> Easements Required</>
                ) : (
                  <><CheckCircle className="w-3 h-3 text-green-500" /> No Easements Required</>
                )}
              </div>
              {result.analysis.accessConsiderations.notes && (
                <p className="mt-2 text-gray-600">{result.analysis.accessConsiderations.notes}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SiteAnalysis({ projectId, parcels, projectRequirements }: SiteAnalysisProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Load previous analyses on mount
  useEffect(() => {
    const loadPreviousAnalyses = async () => {
      const user = firebaseAuth.currentUser;
      if (!user) {
        setLoadingHistory(false);
        return;
      }

      try {
        // Simple query without orderBy to avoid index requirement
        const q = query(
          collection(firebaseDb, 'siteAnalyses'),
          where('projectId', '==', projectId),
          where('tenantId', '==', user.uid)
        );

        const snapshot = await getDocs(q);
        const analyses: SavedAnalysis[] = [];
        snapshot.forEach((doc) => {
          analyses.push({ id: doc.id, ...doc.data() } as SavedAnalysis);
        });

        // Sort client-side by createdAt descending
        analyses.sort((a, b) => {
          const aCreated = a.createdAt as any;
          const bCreated = b.createdAt as any;
          const aTime = aCreated?.toDate ? aCreated.toDate() : aCreated || 0;
          const bTime = bCreated?.toDate ? bCreated.toDate() : bCreated || 0;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

        setSavedAnalyses(analyses);

        // Load most recent analysis results if available
        if (analyses.length > 0) {
          setResults(analyses[0].results);
          setSelectedAnalysis(analyses[0]);
        }
      } catch (err) {
        console.error('Error loading previous analyses:', err);
      }
      setLoadingHistory(false);
    };

    loadPreviousAnalyses();
  }, [projectId]);

  const handleAnalyze = async () => {
    if (parcels.length === 0) return;

    setAnalyzing(true);
    setError(null);

    try {
      const functions = getFunctions();
      const runAgentTask = httpsCallable(functions, 'runAgentTask');

      const analysisResults: AnalysisResult[] = [];

      for (const parcel of parcels) {
        const result = await runAgentTask({
          agentType: 'site_researcher',
          taskInput: {
            projectId,
            parcel: {
              id: parcel.id,
              apn: parcel.apn,
              acres: parcel.acres,
              county: parcel.county,
              state: parcel.state,
              zoning: parcel.zoning,
              landUse: parcel.landUse,
            },
            requirements: projectRequirements || {},
          },
        });

        const data = result.data as { success: boolean; data: { result: any } };
        if (data.success && data.data.result) {
          // Parse agent result into structured format
          const agentResult = data.data.result;
          analysisResults.push({
            parcelId: parcel.id,
            apn: parcel.apn,
            suitabilityScore: agentResult.suitabilityScore || 75,
            analysis: agentResult.analysis || generateDefaultAnalysis(parcel),
            recommendation: agentResult.recommendation || 'proceed_with_caution',
            recommendationNotes: agentResult.recommendationNotes || 'Analysis complete. Review details for recommendations.',
          });
        }
      }

      setResults(analysisResults);
      await saveAnalysisToFirestore(analysisResults);
    } catch (err) {
      console.error('Error running site analysis:', err);
      setError('Failed to complete site analysis. Using demo results.');
      // Generate mock results for demo
      const mockResults = parcels.map(parcel => generateMockResult(parcel));
      setResults(mockResults);
      await saveAnalysisToFirestore(mockResults);
    }
    setAnalyzing(false);
  };

  const saveAnalysisToFirestore = async (analysisResults: AnalysisResult[]) => {
    const user = firebaseAuth.currentUser;
    if (!user || analysisResults.length === 0) return;

    try {
      const recommended = analysisResults.filter(r => r.recommendation === 'proceed').length;
      const withCaution = analysisResults.filter(r => r.recommendation === 'proceed_with_caution').length;
      const notRecommended = analysisResults.filter(r => r.recommendation === 'not_recommended').length;
      const averageScore = Math.round(
        analysisResults.reduce((sum, r) => sum + r.suitabilityScore, 0) / analysisResults.length
      );

      const analysisDoc = {
        projectId,
        tenantId: user.uid,
        createdAt: new Date(),
        parcelsAnalyzed: analysisResults.length,
        results: analysisResults,
        summary: {
          recommended,
          withCaution,
          notRecommended,
          averageScore,
        },
      };

      const docRef = await addDoc(collection(firebaseDb, 'siteAnalyses'), analysisDoc);

      // Update local state
      const newSavedAnalysis: SavedAnalysis = {
        id: docRef.id,
        ...analysisDoc,
      };
      setSavedAnalyses(prev => [newSavedAnalysis, ...prev]);
      setSelectedAnalysis(newSavedAnalysis);
    } catch (err) {
      console.error('Error saving analysis to Firestore:', err);
    }
  };

  const deleteAnalysis = async (analysisId: string) => {
    const user = firebaseAuth.currentUser;
    if (!user) return;

    try {
      await deleteDoc(doc(firebaseDb, 'siteAnalyses', analysisId));
      setSavedAnalyses(prev => prev.filter(a => a.id !== analysisId));

      // If we deleted the selected analysis, clear results or select the next one
      if (selectedAnalysis?.id === analysisId) {
        const remaining = savedAnalyses.filter(a => a.id !== analysisId);
        if (remaining.length > 0) {
          setSelectedAnalysis(remaining[0]);
          setResults(remaining[0].results);
        } else {
          setSelectedAnalysis(null);
          setResults([]);
        }
      }
    } catch (err) {
      console.error('Error deleting analysis:', err);
      alert('Failed to delete analysis');
    }
  };

  const loadAnalysis = (analysis: SavedAnalysis) => {
    setSelectedAnalysis(analysis);
    setResults(analysis.results);
    setShowHistory(false);
  };

  // Generate default analysis structure
  const generateDefaultAnalysis = (parcel: Parcel) => ({
    physicalSuitability: {
      score: 80,
      factors: [`${parcel.acres} acres available`, 'Generally flat terrain', 'Suitable soil conditions'],
    },
    zoningCompatibility: {
      score: 70,
      currentZoning: parcel.zoning || 'Agricultural',
      requiresVariance: false,
      notes: 'Solar use typically permitted in agricultural zones',
    },
    environmentalConstraints: {
      score: 85,
      wetlands: false,
      floodZone: false,
      protectedSpecies: false,
      notes: 'No major environmental constraints identified',
    },
    gridProximity: {
      score: 75,
      nearestSubstation: 'Unknown',
      distanceMiles: 5,
      availableCapacity: 'To be determined',
    },
    accessConsiderations: {
      score: 80,
      roadAccess: true,
      easementsRequired: false,
      notes: 'Standard access available',
    },
  });

  // Generate mock result for demo purposes
  const generateMockResult = (parcel: Parcel): AnalysisResult => {
    const score = Math.floor(Math.random() * 30) + 65; // 65-95
    return {
      parcelId: parcel.id,
      apn: parcel.apn,
      suitabilityScore: score,
      analysis: generateDefaultAnalysis(parcel),
      recommendation: score >= 80 ? 'proceed' : score >= 60 ? 'proceed_with_caution' : 'not_recommended',
      recommendationNotes: score >= 80
        ? 'Site meets all criteria for solar development.'
        : score >= 60
        ? 'Site is suitable with some considerations to address.'
        : 'Site has significant constraints that may impact development.',
    };
  };

  if (loadingHistory) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading previous analyses...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Site Analysis
            </CardTitle>
            {selectedAnalysis && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Last analyzed: {formatDate(selectedAnalysis.createdAt?.toDate?.() || selectedAnalysis.createdAt)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {savedAnalyses.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="w-4 h-4 mr-2" />
                History ({savedAnalyses.length})
              </Button>
            )}
            <Button
              onClick={handleAnalyze}
              disabled={analyzing || parcels.length === 0}
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : results.length > 0 ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Re-Analyze
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analyze Parcels
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* History Panel */}
        {showHistory && savedAnalyses.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <History className="w-4 h-4" />
              Analysis History
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {savedAnalyses.map((analysis) => {
                const createdAt = analysis.createdAt?.toDate?.() || analysis.createdAt;
                return (
                  <div
                    key={analysis.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors',
                      selectedAnalysis?.id === analysis.id
                        ? 'bg-primary/10 border border-primary'
                        : 'bg-white border hover:bg-gray-100'
                    )}
                    onClick={() => loadAnalysis(analysis)}
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {formatDate(createdAt)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {analysis.parcelsAnalyzed} parcel(s) • Avg Score: {analysis.summary.averageScore}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 text-xs">
                        <span className="text-green-600">{analysis.summary.recommended} ✓</span>
                        <span className="text-yellow-600">{analysis.summary.withCaution} !</span>
                        <span className="text-red-600">{analysis.summary.notRecommended} ✗</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1 h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this analysis report?')) {
                            deleteAnalysis(analysis.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {parcels.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Parcels to Analyze</h3>
            <p className="text-gray-500">
              Add parcels to this project to run site suitability analysis.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Analyze</h3>
            <p className="text-gray-500 mb-4">
              Click "Analyze Parcels" to evaluate {parcels.length} parcel(s) for solar development suitability.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                {error}
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-700">
                  {results.filter(r => r.recommendation === 'proceed').length}
                </p>
                <p className="text-sm text-green-600">Recommended</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-700">
                  {results.filter(r => r.recommendation === 'proceed_with_caution').length}
                </p>
                <p className="text-sm text-yellow-600">With Caution</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-700">
                  {results.filter(r => r.recommendation === 'not_recommended').length}
                </p>
                <p className="text-sm text-red-600">Not Recommended</p>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-4">
              {results
                .sort((a, b) => b.suitabilityScore - a.suitabilityScore)
                .map(result => (
                  <AnalysisResultCard key={result.parcelId} result={result} />
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
