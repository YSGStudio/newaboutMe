'use client';

/**
 * StarboardPanel — 교사·학생 "별빛보드" 탭의 진입점
 * 원본 클래스보드의 페이지(프로젝트 목록 / 평가 기준 / 프로젝트 방 안의 화면들)를 탭 안의 내부 상태로 전환합니다.
 * 교사는 선택한 학급(classId) 기준으로, 학생은 자기 학급 기준으로 동작합니다.
 */
import { useCallback, useEffect, useState } from 'react';
import Tabs from '@/components/ui/Tabs';
import { SbProvider, type Screen } from './context';
import ProjectList from './ProjectList';
import ProjectRoom from './ProjectRoom';
import CriteriaManager from './CriteriaManager';

type Props = { kind: 'teacher' | 'student'; classId?: string };

export default function StarboardPanel({ kind, classId }: Props) {
  const [screen, setScreen] = useState<Screen>({ name: 'projects' });
  const go = useCallback((s: Screen) => {
    setScreen(s);
    window.scrollTo({ top: 0 });
  }, []);

  // 교사가 학급을 바꾸면 프로젝트 목록으로 돌아간다
  useEffect(() => {
    setScreen({ name: 'projects' });
  }, [classId]);

  const top = screen.name === 'projects' || screen.name === 'criteria';

  return (
    <SbProvider kind={kind} go={go}>
      <div className="sb-panel">
        {screen.name !== 'projects' && (
          <div className="sb-feature-bar">
            <button type="button" className="sb-btn-dark" onClick={() => go({ name: 'projects' })}>
              <span aria-hidden="true">✦</span> 별빛보드
            </button>
            <span className="sb-feature-role">{kind === 'teacher' ? '교사' : '학생'}</span>
          </div>
        )}
        {kind === 'teacher' && top && (
          <Tabs
            items={[
              { key: 'projects', label: '프로젝트', icon: '🗂️' },
              { key: 'criteria', label: '평가 기준', icon: '⭐' },
            ]}
            value={screen.name}
            onChange={(key) => go({ name: key as 'projects' | 'criteria' })}
          />
        )}
        {screen.name === 'projects' && <ProjectList classId={classId} />}
        {screen.name === 'criteria' && kind === 'teacher' && <CriteriaManager />}
        {!top && <ProjectRoom key={screen.projectId} screen={screen} />}
      </div>
    </SbProvider>
  );
}
