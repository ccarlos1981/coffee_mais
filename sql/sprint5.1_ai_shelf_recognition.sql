-- Migration: Sprint 5.1 AI Shelf Recognition & Planogram Compliance
-- Description: Create tables for AI reference products, planograms, training datasets, and shelf analysis results.

-- 1. AI Product Reference Table
CREATE TABLE IF NOT EXISTS public.cm_ai_product_reference (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    brand VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    package_type VARCHAR(100),
    primary_color VARCHAR(50),
    reference_image_url TEXT,
    image_front_url TEXT,
    image_side_url TEXT,
    image_45deg_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE public.cm_ai_product_reference ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_ai_product_ref ON public.cm_ai_product_reference;
CREATE POLICY select_ai_product_ref ON public.cm_ai_product_reference FOR SELECT TO authenticated USING (true);

-- 2. PDV Expected Planogram Table
CREATE TABLE IF NOT EXISTS public.cm_pdv_planograma (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdv_id TEXT NOT NULL REFERENCES public.base_atendimento(cod_parceiro) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL REFERENCES public.cm_ai_product_reference(sku) ON DELETE CASCADE,
    expected_facings INT NOT NULL DEFAULT 1,
    shelf_number INT NOT NULL DEFAULT 1,
    position_x FLOAT,
    position_y FLOAT,
    roi_x1 FLOAT NOT NULL DEFAULT 0.0,
    roi_y1 FLOAT NOT NULL DEFAULT 0.0,
    roi_x2 FLOAT NOT NULL DEFAULT 1.0,
    roi_y2 FLOAT NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_pdv_sku UNIQUE(pdv_id, sku)
);

-- Enable RLS & Policies
ALTER TABLE public.cm_pdv_planograma ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_pdv_planograma ON public.cm_pdv_planograma;
CREATE POLICY select_pdv_planograma ON public.cm_pdv_planograma FOR SELECT TO authenticated USING (true);

-- 3. AI Training Dataset Table
CREATE TABLE IF NOT EXISTS public.cm_ai_training_dataset (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) NOT NULL REFERENCES public.cm_ai_product_reference(sku) ON DELETE CASCADE,
    image_type VARCHAR(50) NOT NULL CHECK (image_type IN ('PACKSHOT_FRONT', 'PACKSHOT_SIDE', 'REAL_SHELF', 'RUPTURE_EXAMPLE', 'COMPETITOR_EXAMPLE')),
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE public.cm_ai_training_dataset ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_ai_training_dataset ON public.cm_ai_training_dataset;
CREATE POLICY select_ai_training_dataset ON public.cm_ai_training_dataset FOR SELECT TO authenticated USING (true);

-- 4. AI Shelf Analysis Table
CREATE TABLE IF NOT EXISTS public.cm_ai_shelf_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visita_id UUID NOT NULL REFERENCES public.cm_promotor_visita(id) ON DELETE CASCADE,
    promotor_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    detected_products JSONB,
    total_facings INT,
    coffee_mais_facings INT,
    shelf_share_percent FLOAT,
    rupture_status VARCHAR(20) CHECK (rupture_status IN ('TOTAL', 'PARCIAL', 'OK')),
    planogram_score INT CHECK (planogram_score >= 0 AND planogram_score <= 100),
    ai_confidence FLOAT,
    image_width INT,
    image_height INT,
    captured_at TIMESTAMPTZ,
    camera_metadata JSONB,
    analysis_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (analysis_status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED')),
    processing_started_at TIMESTAMPTZ,
    processing_finished_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE public.cm_ai_shelf_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS manage_ai_shelf_analysis ON public.cm_ai_shelf_analysis;
CREATE POLICY manage_ai_shelf_analysis ON public.cm_ai_shelf_analysis FOR ALL TO authenticated USING (true);

-- 5. Seed Reference Products (SKUs Coffee Mais)
INSERT INTO public.cm_ai_product_reference (sku, brand, product_name, category, package_type, primary_color, reference_image_url, image_front_url, image_side_url, image_45deg_url)
VALUES
  ('COFFEE_MAIS_CLASSICO', 'Coffee Mais', 'Café Clássico Moído 250g', 'Café Moído', 'Vácuo', 'Amarelo', 'https://coffeemais.com/ref-classico.jpg', 'https://coffeemais.com/ref-classico-front.jpg', 'https://coffeemais.com/ref-classico-side.jpg', 'https://coffeemais.com/ref-classico-45.jpg'),
  ('COFFEE_MAIS_INTENSO', 'Coffee Mais', 'Café Intenso Moído 250g', 'Café Moído', 'Vácuo', 'Vermelho', 'https://coffeemais.com/ref-intenso.jpg', 'https://coffeemais.com/ref-intenso-front.jpg', 'https://coffeemais.com/ref-intenso-side.jpg', 'https://coffeemais.com/ref-intenso-45.jpg'),
  ('COFFEE_MAIS_GOURMET', 'Coffee Mais', 'Café Gourmet Moído 250g', 'Café Moído', 'Vácuo', 'Marrom', 'https://coffeemais.com/ref-gourmet.jpg', 'https://coffeemais.com/ref-gourmet-front.jpg', 'https://coffeemais.com/ref-gourmet-side.jpg', 'https://coffeemais.com/ref-gourmet-45.jpg'),
  ('COFFEE_MAIS_ESPRESSO', 'Coffee Mais', 'Café Espresso Grãos 1kg', 'Café em Grãos', 'Saco Sanfonado', 'Preto', 'https://coffeemais.com/ref-espresso.jpg', 'https://coffeemais.com/ref-espresso-front.jpg', 'https://coffeemais.com/ref-espresso-side.jpg', 'https://coffeemais.com/ref-espresso-45.jpg')
ON CONFLICT (sku) DO NOTHING;

-- 6. Seed Expected Planograms for active pilot PDVs
INSERT INTO public.cm_pdv_planograma (pdv_id, sku, expected_facings, shelf_number, position_x, position_y, roi_x1, roi_y1, roi_x2, roi_y2)
VALUES
  -- PDV 207250
  ('207250', 'COFFEE_MAIS_CLASSICO', 4, 1, 0.1, 0.2, 0.05, 0.1, 0.45, 0.35),
  ('207250', 'COFFEE_MAIS_INTENSO', 3, 1, 0.5, 0.2, 0.45, 0.1, 0.85, 0.35),
  ('207250', 'COFFEE_MAIS_GOURMET', 3, 2, 0.1, 0.5, 0.05, 0.4, 0.45, 0.65),
  -- PDV 107395
  ('107395', 'COFFEE_MAIS_CLASSICO', 3, 1, 0.1, 0.2, 0.05, 0.1, 0.45, 0.35),
  ('107395', 'COFFEE_MAIS_ESPRESSO', 2, 3, 0.1, 0.8, 0.05, 0.7, 0.45, 0.95),
  -- PDV 38532
  ('38532', 'COFFEE_MAIS_CLASSICO', 3, 1, 0.1, 0.2, 0.05, 0.1, 0.45, 0.35),
  ('38532', 'COFFEE_MAIS_INTENSO', 3, 1, 0.5, 0.2, 0.45, 0.1, 0.85, 0.35),
  -- PDV 81953
  ('81953', 'COFFEE_MAIS_CLASSICO', 5, 1, 0.1, 0.2, 0.05, 0.1, 0.45, 0.35),
  ('81953', 'COFFEE_MAIS_GOURMET', 4, 2, 0.1, 0.5, 0.05, 0.4, 0.45, 0.65),
  -- PDV 29439
  ('29439', 'COFFEE_MAIS_CLASSICO', 4, 1, 0.1, 0.2, 0.05, 0.1, 0.45, 0.35),
  ('29439', 'COFFEE_MAIS_INTENSO', 3, 1, 0.5, 0.2, 0.45, 0.1, 0.85, 0.35)
ON CONFLICT ON CONSTRAINT unique_pdv_sku DO NOTHING;

-- 7. Seed Training Dataset
INSERT INTO public.cm_ai_training_dataset (sku, image_type, image_url)
VALUES
  ('COFFEE_MAIS_CLASSICO', 'PACKSHOT_FRONT', 'https://coffeemais.com/dataset/classico-front.jpg'),
  ('COFFEE_MAIS_CLASSICO', 'PACKSHOT_SIDE', 'https://coffeemais.com/dataset/classico-side.jpg'),
  ('COFFEE_MAIS_CLASSICO', 'REAL_SHELF', 'https://coffeemais.com/dataset/classico-shelf-1.jpg'),
  ('COFFEE_MAIS_INTENSO', 'PACKSHOT_FRONT', 'https://coffeemais.com/dataset/intenso-front.jpg'),
  ('COFFEE_MAIS_INTENSO', 'REAL_SHELF', 'https://coffeemais.com/dataset/intenso-shelf-1.jpg'),
  ('COFFEE_MAIS_ESPRESSO', 'PACKSHOT_FRONT', 'https://coffeemais.com/dataset/espresso-front.jpg'),
  ('COFFEE_MAIS_CLASSICO', 'RUPTURE_EXAMPLE', 'https://coffeemais.com/dataset/rupture-classico.jpg'),
  ('COFFEE_MAIS_CLASSICO', 'COMPETITOR_EXAMPLE', 'https://coffeemais.com/dataset/competitor-intrusion.jpg')
ON CONFLICT DO NOTHING;
